package com.ecocode.project;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

public class ProjectIndexer {

    public List<JavaFileInfo> indexProject(Path projectPath) {

        List<JavaFileInfo> files = new ArrayList<>();

        try (Stream<Path> paths = Files.walk(projectPath)) {

            paths.filter(Files::isRegularFile)
                    .filter(path -> path.toString().endsWith(".java"))
                    .forEach(path -> {

                        try {
                            long lineCount;

                            try (Stream<String> lines = Files.lines(path)) {
                                lineCount = lines.count();
                            }

                            String normalizedPath = path.toString().replace('\\', '/');
                            boolean isTestFile = normalizedPath.contains("/src/test/") || normalizedPath.contains("/test/");

                            files.add(
                                    new JavaFileInfo(
                                            path.getFileName().toString(),path,
                                            lineCount,
                                            isTestFile
                                    )
                            );

                        } catch (IOException e) {
                            System.out.println(
                                    "Could not read file: " + path
                            );
                        }
                    });

        } catch (IOException e) {
            System.out.println(
                    "Could not scan project: " + e.getMessage()
            );
        }

        return files;
    }
}