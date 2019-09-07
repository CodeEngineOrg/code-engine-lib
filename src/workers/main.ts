import { workerData } from "worker_threads";
import { Executor } from "./executor";
import { ExecutorConfig } from "./types";

let self = new Executor(workerData as ExecutorConfig);
