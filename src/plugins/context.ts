import { Logger } from "../loggers/types";
import { PluginContext } from "./types";

/**
 * The internal CodeEngine implementation of the `PluginContext` interface.
 */
export class CodeEnginePluginContext implements PluginContext {
  public readonly logger: Logger;
  public readonly cwd: string;
  public readonly dev: boolean;
  public readonly debug: boolean;

  public constructor(context: PluginContext) {
    this.logger = context.logger;
    this.cwd = context.cwd;
    this.dev = context.dev;
    this.debug = context.debug;
  }

  /**
   * Returns a string representation of the context.
   */
  public toString(): string {
    return "PluginContext";
  }

  /**
   * Returns the name to use for `Object.toString()`.
   */
  public get [Symbol.toStringTag](): string {
    return "PluginContext";
  }
}
