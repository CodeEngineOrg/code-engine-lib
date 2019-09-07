import { CodeEngine } from "../code-engine";
import { Logger } from "../loggers";
import { PluginContext } from "./types";

/**
 * The internal CodeEngine implementation of the `PluginContext` interface.
 */
export class CodeEnginePluginContext implements PluginContext {
  public logger: Logger;

  public constructor(engine: CodeEngine) {
    this.logger = engine.logger;
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
