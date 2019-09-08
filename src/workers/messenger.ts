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
  private _requestHandler?: RequestHandler;
  private readonly _pending = new Map<number, PendingRequest>();

  public constructor(port: MessengerPort, handleRequest?: RequestHandler) {
    this._port = port;
    this._requestHandler = handleRequest;
    port.on("message", this._handleMessage.bind(this));
  }

  /**
   * Sends a request to the `Executor` and awaits a response.
   */
  public async sendRequest<T>(req: Omit<OriginalRequest, "type" | "id">): Promise<T> {
    let request = req as OriginalRequest;
    request.type = MessageType.Request;
    request.id = ++requestCounter;

    return new Promise<T>((resolve, reject) => {
      this._port.postMessage(request);
      this._pending.set(request.id,
        { event: request.event, handleSubRequest: request.handleSubRequest, resolve, reject });
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
      if ("originalRequestId" in request) {
        // This is a sub-request from the executor, so find the original request that it relates to
        let originalRequest = this._pending.get(request.originalRequestId)!;

        // Allow the original request to handle the sub-request
        result = await originalRequest.handleSubRequest!(request);
      }
      else {
        // This is an original request, so allow the parent class to handle it
        result = await this._requestHandler!(request);
      }
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
      // The executor is responding to a request
      let request = this._pending.get(response.requestId)!;

      // Delete the request, now that it's done
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
 * Handles incoming messages from across the thread boundary.
 */
export type RequestHandler = (request: Request) => Promise<unknown>;


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
 * A request sent between a `CodeEngineWorker` and `Executor` to perform a new operation.
 */
export interface OriginalRequest extends Request {
  /**
   * An optional function to handle sub=requests sent while processing the request.
   */
  handleSubRequest?: RequestHandler;
}


/**
 * A request for additional information that is needed to fulfill an `OriginalRequest`.
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
   * An optional function to handle sub=requests sent while processing the request.
   */
  handleSubRequest?: RequestHandler;

  /**
   * Resolves the pending Promise when the `Executor` responds.
   */
  resolve(value: unknown): void;

  /**
   * Rejects the pending Promise when an error occurs or the thread is terminated.
   */
  reject(reason: ErrorPOJO): void;
}
