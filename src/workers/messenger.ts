import { EventEmitter } from "events";
import { ErrorPOJO, ono } from "ono";
import { MessagePort } from "worker_threads";
import { WorkerEvent } from "./types";

let requestCounter = 0;

/**
 * Handles request/response message lifecycles.
 */
export class Messenger {
  private _port: MessengerPort;
  private _requestHandlers: RequestHandlers;
  private readonly _pending = new Map<number, PendingRequest>();

  public constructor(port: MessengerPort, requestHandlers?: RequestHandlers) {
    this._port = port;
    this._requestHandlers = requestHandlers || {};
    port.on("message", this._handleMessage.bind(this));
  }

  /**
   * Sends a request to the `Executor` and awaits a response.
   */
  public async sendRequest<T>({ event, data, ...subRequestHandlers }: SendRequestArgs): Promise<T> {
    let request: Request = {
      type: MessageType.Request,
      id: ++requestCounter,
      event,
      data,
    };

    return new Promise<T>((resolve, reject) => {
      this._port.postMessage(request);
      this._pending.set(request.id, { event: request.event, subRequestHandlers, resolve, reject });
    });
  }

  /**
   * Rejects all pending messages between the `CodeEngineWorker` and the `Executor`.
   */
  public rejectAllPending(error: Error): void {
    let currentlyPending = [...this._pending.values()];
    this._pending.clear();

    for (let pending of currentlyPending) {
      pending.reject(error);
    }
  }

  /**
   * Sends a response to the `Executor`.
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
    let result, error;

    try {
      let handler: RequestHandler | undefined;

      if ("originalRequestId" in request) {
        // This is a sub-request, so find the original request that it relates to
        let originalRequest = this._pending.get(request.originalRequestId)!;

        // Call the corresponding sub-request handler of the original request
        handler = originalRequest.subRequestHandlers[request.event];
      }
      else {
        // This is an original request, so call the corresponding request handler
        handler = this._requestHandlers[request.event];
      }

      if (!handler) {
        throw ono(`Unexpected event: ${request.event}`, { event: request.event });
      }

      result = await (handler(request.data) as Promise<unknown>);
    }
    catch (err) {
      // An error occurred while handling the request, so respond with the error.
      error = ono(err as Error).toJSON();
    }

    this._sendResponse({
      requestId: request.id,
      value: result,
      error,
    });
  }

  /**
   * Handles responses to pending requests.
   */
  private _handleResponse(response: Response) {
    try {
      // Delete the request, now that it's done
      let request = this._pending.get(response.requestId)!;
      this._pending.delete(response.requestId);

      if (response.error) {
        request.reject(response.error);
      }
      else {
        request.resolve(response.value);
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
export type RequestHandler = (data?: unknown) => unknown;


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
 * A message sent between a `CodeEngineWorker` and `Executor` that ends a request/response cycle.
 */
export interface Response {
  type: MessageType.Response;
  requestId: number;
  error?: ErrorPOJO;
  value?: unknown;
}


/**
 * The arguments for the `Messenger.sendRequest()` method.  Basically, it's a `Request` object
 * (minus the fields that are set internally by `Messenger.sendRequest()`) and optional sub-request
 * handlers.
 */
export type SendRequestArgs = Omit<Request, "type" | "id"> & RequestHandlers;


/**
 * A request for additional information that is needed to fulfill a previous request.
 */
export interface SubRequest extends Request {
  originalRequestId: number;
}


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
  resolve(value: unknown): void;

  /**
   * Rejects the pending Promise when an error occurs or the thread is terminated.
   */
  reject(reason: ErrorPOJO): void;
}
