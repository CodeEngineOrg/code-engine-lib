import { parentPort, threadId } from "worker_threads";
import { Executor } from "./executor";

let self = new Executor(threadId, parentPort!);
