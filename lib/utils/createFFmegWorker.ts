export const createFFmpegWorker = (ffmpegData: any) => {
  const workerCode = `
    self.onmessage = async (event) => {
      const { action, ffmpegData } = event.data;

      try {
        const { file, file_name, to } = action;
        const { FFmpeg, fetchFile } = ffmpegData;
        const ffmpeg = new FFmpeg();
        await ffmpeg.load();

        const inputExtension = file_name.split('.').pop();
        const inputFileName = \`input.\${inputExtension}\`;
        const outputFileName = file_name.replace(/\\.[^/.]+$/, "") + "." + to;

        await ffmpeg.writeFile(inputFileName, new Uint8Array(await file.arrayBuffer()));

        let ffmpeg_cmd = ["-i", inputFileName, outputFileName];
        if (to === "3gp") {
          ffmpeg_cmd = [
            "-i", inputFileName,
            "-r", "20",
            "-s", "352x288",
            "-vb", "400k",
            "-acodec", "aac",
            "-strict", "experimental",
            "-ac", "1",
            "-ar", "8000",
            "-ab", "24k",
            outputFileName,
          ];
        }

        await ffmpeg.run(...ffmpeg_cmd);

        const outputData = await ffmpeg.readFile(outputFileName);
        const blob = new Blob([outputData.buffer], { type: file.type.split("/")[0] });
        const url = URL.createObjectURL(blob);

        self.postMessage({ url, outputFileName });
      } catch (error) {
        self.postMessage({ error: 'File conversion failed' });
      }
    };
  `

  const blob = new Blob([workerCode], { type: "application/javascript" })
  return new Worker(URL.createObjectURL(blob))
}
