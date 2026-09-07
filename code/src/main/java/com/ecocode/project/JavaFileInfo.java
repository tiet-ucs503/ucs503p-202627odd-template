package com.ecocode.project;
import java.nio.file.Path;

public class JavaFileInfo {

    private String fileName;
    private Path path;
    private long lineCount;
    private boolean isTestFile;

    public JavaFileInfo(
            String fileName,
            Path path,
            long lineCount,
            boolean isTestFile) {

        this.fileName = fileName;
        this.path = path;
        this.lineCount = lineCount;
        this.isTestFile = isTestFile;
    }

    public String getFileName() {
        return fileName;
    }

    public Path getPath() {
        return path;
    }

    public long getLineCount() {
        return lineCount;
    }

    public boolean isTestFile() {
        return isTestFile;
    }
}