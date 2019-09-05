import { workerData } from "worker_threads";
import { WorkerConfig } from "./config";
import { Executor } from "./executor";

let self = new Executor(workerData as WorkerConfig);
