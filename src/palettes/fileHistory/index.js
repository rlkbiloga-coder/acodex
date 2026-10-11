import { getDocText } from "cm/editorUtils";
import palette from "components/palette";
import toast from "components/toast";
import fileHistory from "lib/fileHistory";
import FileDiff from "pages/fileDiff";

function formatTime(timestamp) {
	const date = new Date(timestamp);
	const pad = (value) => String(value).padStart(2, "0");
	return `${pad(date.getHours())}:${pad(date.getMinutes())} · ${pad(
		date.getDate(),
	)}/${pad(date.getMonth() + 1)}`;
}

export default async function fileHistoryPalette() {
	const file = editorManager.activeFile;
	if (!file?.uri) {
		toast("No file open");
		return;
	}

	const versions = (await fileHistory.getVersions(file.uri)).slice().reverse();
	if (!versions.length) {
		toast(strings["no saved versions yet"] || "No saved versions yet");
		return;
	}

	palette(
		() =>
			versions.map((version) => ({
				value: version.id,
				text: `<div class="palette-content-history">
      <span>${formatTime(version.timestamp)}</span>
      <small>${Math.round(version.size / 1024)} KB</small>
    <div>`,
			})),
		async (versionId) => {
			const oldText = await fileHistory.getVersionContent(file.uri, versionId);
			if (oldText === null) {
				toast(strings["restore failed"] || "Restore failed");
				return;
			}
			const currentText = getDocText(file.session);
			FileDiff({
				title: file.filename,
				oldText,
				newText: currentText,
				oldLabel: `${formatTime(versions.find((v) => v.id === versionId).timestamp)}`,
				newLabel: strings["current"] || "Current",
				onRestore: async () => {
					const cursorPosition = editorManager.editor.getCursorPosition();
					file.session.setValue(oldText);
					editorManager.editor.moveCursorToPosition(cursorPosition);
					editorManager.onupdate("file-restored");
					return true;
				},
			});
		},
		strings["file history"] || "File history",
	);
}
