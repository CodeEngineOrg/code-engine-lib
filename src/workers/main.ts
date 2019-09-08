import { workerData } from "worker_threads";
import { ExecutorConfig } from "./config";
import { Executor } from "./executor";

let self = new Executor(workerData as ExecutorConfig);
