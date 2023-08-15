export const getNonce = () => {
	let text = "";
	const possible =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

export function generateUUID(): string {
    let dt = new Date().getTime();
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}

export function posixDirname(inputPath: string): string {
    if (!inputPath) {
        return '.';
    }

    const isAbsolutePath = inputPath[0] === '/';
    const segments = inputPath.split('/').filter(Boolean);

    if (segments.length === 0) {
        return isAbsolutePath ? '/' : '.';
    }

    if (isAbsolutePath) {
        segments.pop();
        return '/' + segments.join('/');
    } else {
        segments.pop();
        return segments.length > 0 ? segments.join('/') : '.';
    }
}

export function posixBasename(inputPath: string, ext?: string): string {
    if (!inputPath) {
        return '';
    }

    // Split the path into segments
    const segments = inputPath.split('/').filter(Boolean);

    // If the path was '/' or empty, return '/'
    if (segments.length === 0) {
        return inputPath.endsWith('/') ? '/' : '';
    }

    // Get the last part of the path
    let base = segments.pop() as string;

    // Remove the extension if it's provided and the base ends with it
    if (ext && base.endsWith(ext)) {
        base = base.slice(0, -ext.length);
    }

    return base;
}