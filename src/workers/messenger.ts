import { EventEmitter } from "events";
import { ErrorPOJO, ono } from "ono";
import { MessagePort } from "worker_threads";
import { serialize } from "./serialization";
import { WorkerEvent } from "./types";

let requestCounter = 0;

/**
 * Handles request/response message lifecycles.
 */
export class Messenger {
  private _port: MessengerPort;
  private _requestHandlers: RequestHandlers;
  private readonly _pending = new Map<number, PendingRequest>();
  private readonly _completed: number[] = [];

  public constructor(port: MessengerPort, requestHandlers?: RequestHandlers) {
    this._port = port;
    this._requestHandlers = requestHandlers || {};
    port.on("message", this._handleMessage.bind(this));
  }

  /**
   * Sends a request and awaits a response.
   */
  public async sendRequest<T>(request: SendRequestArgs): Promise<T> {
    return this._sendRequest(request);
  }

  /**
   * Sends a sub-request for additional information that is needed to fulfill a previous request.
   */
  public async sendSubRequest<T>(request: SendSubRequestArgs): Promise<T> {
    return this._sendRequest(request);
  }

  /**
   * Rejects all pending messages between the `CodeEngineWorker` and the `Executor`.
   */
  public rejectAllPending(error: Error): void {
    let currentlyPending = [...this._pending.entries()];
    this._pending.clear();

    for (let [requestId, pending] of currentlyPending) {
      this._completed.push(requestId);
      pending.reject(error);
    }
  }

  /**
   * Sends a request and awaits a response.
   */
  private async _sendRequest<T>(request: SendRequestArgs): Promise<T>;
  private async _sendRequest<T>(arg: SendRequestArgs & SendSubRequestArgs): Promise<T> {
    let { originalRequestId, event, data, ...subRequestHandlers } = arg;

    let request: SubRequest = {
      type: MessageType.Request,
      id: ++requestCounter,
      originalRequestId,
      event,
      data,
    };

    return new Promise<T>((resolve, reject) => {
      this._port.postMessage(request);
      this._pending.set(request.id, { event: request.event, subRequestHandlers, resolve, reject });
    });
  }

  /**
   * Sends a response to a request
   */
  private _sendResponse(res: Omit<Response, "type">): void {
    let response = res as Response;
    response.type = MessageType.Response;

    this._port.postMessage(response);
  }

  /**
   * Handles messages from the `Executor`.
   */
  private async _handleMessage(message: Request | SubRequest | Response) {
    if (message.type === MessageType.Request) {
      await this._handleRequest(message);
    }
    else {
      this._handleResponse(message);
    }
  }

  /**
   * Handles incoming requests from the message port.
   */
  private async _handleRequest(request: Request | SubRequest) {
    try {
      let handler: RequestHandler | undefined;
      let { originalRequestId } = request as SubRequest;

      if (originalRequestId) {
        // This is a sub-request, so find the original request that it relates to
        let originalRequest = this._pending.get(originalRequestId)!;

        // Call the corresponding sub-request handler of the original request
        handler = originalRequest.subRequestHandlers[request.event];
      }
      else {
        // This is an original request, so call the corresponding request handler
        handler = this._requestHandlers[request.event];
        originalRequestId = request.id;
      }

      if (!handler) {
        throw ono({ event: request.event }, `Unexpected event: ${request.event}`);
      }

      // Create callback functions that allow the handler to send a sub-request or throw an error
      let sendSubRequest = (req: SubRequest) =>
        this.sendSubRequest({ ...req, originalRequestId });

      let error = (err: Error) =>
        this._sendResponse({ requestId: request.id, error: serialize(err) as ErrorPOJO });

      // Call the handler
      let result = await (handler(request.data, { sendSubRequest, error }) as Promise<unknown>);
      this._sendResponse({ requestId: request.id, result });
    }
    catch (err) {
      // An error occurred while handling the request, so respond with the error.
      this._sendResponse({ requestId: request.id, error: serialize(err) as ErrorPOJO });
    }
  }

  /**
   * Handles responses to pending requests.
   */
  private _handleResponse(response: Response) {
    try {
      // Delete the request, now that it's done
      let request = this._pending.get(response.requestId)!;
      this._pending.delete(response.requestId);

      if (request) {
        this._completed.push(response.requestId);

        if (response.error) {
          request.reject(response.error);
        }
        else {
          request.resolve(response.result);
        }
      }
      else if (!this._completed.includes(response.requestId)) {
        // The specified request ID is neither pending nor completed
        throw ono({ requestId: response.requestId }, `Invalid request ID: ${response.requestId}`);
      }

    }
    catch (error) {
      // Something went wrong while handling the response.
      // Forward the error to the message port to be handled by the error handler.
      this._port.emit("error", error);
    }
  }
}


/**
 * A `MessagePort` or `Worker` instance.
 */
export type MessengerPort = EventEmitter & Pick<MessagePort, "postMessage">;


/**
 * Handles incoming requests from across the thread boundary.
 */
export type RequestHandlers = {
  [event in WorkerEvent]?: RequestHandler;
};


/**
 * Handles incoming requests from across the thread boundary.
 */
export type RequestHandler = (data: unknown, callbacks: RequestHandlerCallbacks) => unknown;


/**
 * Callback functions that allows a `RequestHandler` to request additional information or throw an error.
 */
export interface RequestHandlerCallbacks {
  /**
   * Sends a sub-request for additional information that is needed to fulfill the original request.
   */
  sendSubRequest(request: Omit<SendSubRequestArgs, "originalRequestId">): Promise<unknown>;

  /**
   * Rejects the original request when an error occurs.
   */
  error(error: Error | unknown): void;
}


/**
 * The types of messages that can be sent between a `CodeEngineWorker` and `Executor`.
 */
export enum MessageType {
  Request,
  Response,
}


/**
 * A message sent between a `CodeEngineWorker` and `Executor` that initiates a request/response cycle.
 */
export interface Request {
  type: MessageType.Request;
  id: number;
  event: WorkerEvent;
  data?: unknown;
}


/**
 * A request for additional information that is needed to fulfill a previous request.
 */
export interface SubRequest extends Request {
  originalRequestId: number;
}


/**
 * A message sent between a `CodeEngineWorker` and `Executor` that ends a request/response cycle.
 */
export interface Response {
  type: MessageType.Response;
  requestId: number;
  error?: ErrorPOJO;
  result?: unknown;
}


/**
 * The arguments for the `Messenger.sendRequest()` method.  Basically, it's a `Request` object
 * (minus the fields that are set internally by `Messenger.sendRequest()`) and optional sub-request
 * handlers.
 */
export type SendRequestArgs = Omit<Request, "type" | "id"> & RequestHandlers;


/**
 * The arguments for the `Messenger.sendRequest()` method.  Basically, it's a `SubRequest` object
 * (minus the fields that are set internally by `Messenger.sendSubRequest()`).
 */
export type SendSubRequestArgs = Omit<SubRequest, "type" | "id">;


/**
 * A request that was sent from a `CodeEngineWorker` to an `Executor` and is still being processed.
 */
export interface PendingRequest {
  /**
   * The requested action.
   */
  event: WorkerEvent;

  /**
   * Optional functions to handle sub=requests sent while processing the request.
   */
  subRequestHandlers: RequestHandlers;

  /**
   * Resolves the pending Promise when the `Executor` responds.
   */
  resolve(result?: unknown): void;

  /**
   * Rejects the pending Promise when an error occurs or the thread is terminated.
   */
  reject(reason: ErrorPOJO): void;
}
