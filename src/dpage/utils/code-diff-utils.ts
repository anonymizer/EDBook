import * as diff from 'diff';
import { FileChanges, AdditionFileChange, RemovalFileChange, UnchangedFileChange, DiffPatch } from '../../dpage';

function getFileDiff(oldFile: string, newFile: string): FileChanges {
    const codeDiff = diff.diffLines(oldFile, newFile);
    const compressedCodeDiff: FileChanges = codeDiff.map((diffLine) => {
        const { value, count } = diffLine;
        if(diffLine.added) {
            return [1, value] as AdditionFileChange;
        } else if(diffLine.removed) {
            return [-1, count||0] as RemovalFileChange;
        } else {
            return [0, count||0] as UnchangedFileChange;
        }
    });
    return compressedCodeDiff;
}
function applyFileDiff(oldFile: string, changes: FileChanges, ignoreRemovals = false): string {
    const linesAndNewlines = splitLines(oldFile);
    const newFileContents: string[] = [];
    let currPointer = 0;
    for(const change of changes) {
        const type = change[0];
        if(type === -1) { // removal
            const count = change[1];
            if(ignoreRemovals) {
                newFileContents.push(...linesAndNewlines.slice(currPointer, currPointer+count));
            }
            currPointer += count;
        } else if(type === 1) { // addition
            const value = change[1];
            newFileContents.push(value);
        } else {
            const count = change[1];
            newFileContents.push(...linesAndNewlines.slice(currPointer, currPointer+count));
            currPointer += count;
        }
    }
    const newValue = newFileContents.join('');
    return newValue;
}

export function patchFileState(files: {[fname: string]: string}, patch: DiffPatch|undefined, ignoreContentRemoval = false): {[fname: string]: string} {
    const newFiles = {...files};
    if(!patch) { return newFiles; }

    for(const fname of patch.added)     { newFiles[fname] = ''; }
    for(const fname of patch.removed)   { delete newFiles[fname]; }
    for(const fname in patch.codeDiffs) { newFiles[fname] = applyFileDiff(newFiles[fname], patch.codeDiffs[fname], ignoreContentRemoval===true); }

    return newFiles;
}

export function derivePatch(oldFiles: {[fname: string]: string}, newFiles: {[fname: string]: string}): DiffPatch|false {
    const added   = Object.keys(newFiles).filter(f => !Object.prototype.hasOwnProperty.call(oldFiles, f));
    const removed = Object.keys(oldFiles).filter(f => !Object.prototype.hasOwnProperty.call(newFiles, f));
    const changed = Object.keys(newFiles).filter(f => oldFiles[f] !== newFiles[f]);

    if(added.length === 0 && removed.length === 0 && changed.length === 0) { return false; }

    const codeDiffs: {[fname: string]: FileChanges} = {};
    for(const fname of changed) {
        codeDiffs[fname] = getFileDiff(oldFiles[fname] || '', newFiles[fname]);
    }
    return {added, removed, codeDiffs};
}

//https://github.com/kpdecker/jsdiff/blob/3b654c2ed7d5262ed9946de841ad8dae990286c7/src/diff/line.js
function splitLines(str: string) {
    const options = {
        newlineIsToken: false,
        ignoreWhitespace: false
    }
    const retLines = [];
    const linesAndNewlines = str.split(/(\n|\r\n)/);
    // Ignore the final empty token that occurs if the string ends with a new line
    if (!linesAndNewlines[linesAndNewlines.length - 1]) {
        linesAndNewlines.pop();
    }

    // Merge the content and line separators into single tokens
    for (let i = 0; i < linesAndNewlines.length; i++) {
        let line = linesAndNewlines[i];

        if (i % 2 && !options.newlineIsToken) {
            retLines[retLines.length - 1] += line;
        } else {
            if (options.ignoreWhitespace) {
                line = line.trim();
            }
            retLines.push(line);
        }
    }

    return retLines;
}


// const test_case = [
//     `
//     def sum_numbers(a, b):
//         return a + b

//     def subtract_numbers(a, b):
//         return a - b

//     if __name__ == "__main__":
//         x = 5
//         y = 3
//         print("Sum:", sum_numbers(x, y))
//         print("Difference:", subtract_numbers(x, y))
//     z = 20
//     `,

//     `
//     def sum_numbers(a, b):
//         return a + b

//     def subtract_numbers(a, b):
//         return a - b

//     def multiply_numbers(a, b):
//         return a * b

//     if __name__ == "__main__":
//         x = 5
//         y = 3
//         print("Sum:", sum_numbers(x, y))
//         print("Difference:", subtract_numbers(x, y))
//         print("Product:", multiply_numbers(x, y))
//     z = 20
//     `,
//     `
//     def sum_numbers(a, b):
//         return a + b

//     if __name__ == "__main__":
//         x = 5
//         y = 3
//         print("Sum:", sum_numbers(x, y))
//     z = 20
//     `
// ]

// let content = '';
// for(let i = 0; i<test_case.length; i++) {
//     const c = test_case[i];
//     const fileDiff = getFileDiff(content, c);
//     const reconstructedC = applyFileDiff(content, fileDiff);
//     if(reconstructedC !== c) {
//         console.log('Error');
//         console.log('=====================');
//         console.log(reconstructedC);
//         console.log('---------------------');
//         console.log(c);
//         console.log('=====================');
//     }
//     content = c;
// }