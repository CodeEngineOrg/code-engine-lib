import { ChangedFile, Context, FileChange } from "@code-engine/types";
import { debounceIterable, joinIterables } from "@code-engine/utils";
import { PluginController } from "../plugins/plugin-controller";
import { hasWatch } from "../plugins/types";

/**
 * Watches all source files for changes and de-dupes changes that occur within the specified delay window.
 * @internal
 */
// tslint:disable-next-line: no-async-without-await
export async function* watchAllSources(plugins: PluginController[], delay: number, context: Context) {
  let watchers = plugins.filter(hasWatch);
  let fileGenerators = watchers.map((watcher) => watcher.watch(context));
  let batchedFileChanges = debounceIterable(joinIterables(...fileGenerators), delay);

  for await (let changes of batchedFileChanges) {
    let groupedChanges = groupByFile(changes);
    yield dedupeFileChanges(groupedChanges);
  }
}

/**
 * A changed file, with additional metadata that's needed internally by CodeEngine.
 * @internal
 */
export interface Change {
  file: ChangedFile;
  hasContents: boolean;
}

type GroupedFileChanges = Map<string, Change[]>;

/**
 * Groups the given file changes by file path, so we can detect any duplicates
 */
function groupByFile(changes: Change[]): GroupedFileChanges {
  let groupedChanges: GroupedFileChanges = new Map();

  for (let change of changes) {
    let key = change.file.path;
    let fileChanges = groupedChanges.get(key) || [];
    fileChanges.push(change);
    groupedChanges.set(key, fileChanges);
  }

  return groupedChanges;
}

/**
 * De-duplicates file changes. For example, if a file was deleted and then re-created, it will
 * be de-duped as a single modification.
 */
function dedupeFileChanges(groupedChanges: GroupedFileChanges): ChangedFile[] {
  let changedFiles: ChangedFile[] = [];

  for (let changes of groupedChanges.values()) {
    if (changes.length > 1) {
      // Sort the changes by timestamp, and get the first and last change
      changes.sort(byTimestamp);
      let first = changes[0];
      let last = changes[changes.length - 1];

      switch (last.file.change) {
        case FileChange.Created:
          if (first.file.change !== FileChange.Created) {
            // The file was re-created after being deleted/modified,
            // so this is actually just a modification
            last.file.change = FileChange.Modified;
          }
          break;

        case FileChange.Modified:
          if (first.file.change === FileChange.Created) {
            // The file was created and then modified, so this is actually a creation
            last.file.change = FileChange.Created;
          }
          break;

        case FileChange.Deleted:
        default:
          // The previous changes don't matter, because the file was ultimately deleted
          break;
      }

      // Always use the latest contents we have
      last.file.contents = getLatestContents(changes);
      changedFiles.push(last.file);
    }
    else {
      // Nothig to de-dupe
      changedFiles.push(changes[0].file);
    }
  }

  return changedFiles;
}

/**
 * Sorts an array of `CreateFileInfo` objects by their modified time
 */
function byTimestamp(a: Change, b: Change): number {
  return a.file.modifiedAt.valueOf() - b.file.modifiedAt.valueOf();
}

/**
 * Returns the latest contents from a sorted list of `CreateFileInfo` objects.
 */
function getLatestContents(changes: Change[]): Buffer {
  for (let i = changes.length - 1; i >= 0; i--) {
    if (changes[i].hasContents) {
      return changes[i].file.contents;
    }
  }

  return Buffer.alloc(0);
}
