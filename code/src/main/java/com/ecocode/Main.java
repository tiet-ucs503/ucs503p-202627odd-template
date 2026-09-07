package com.ecocode;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.JavaProjectParser;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.analyzer.SymbolSolver;
import com.ecocode.analyzer.rules.*;
import com.ecocode.model.StaticIssue;
import com.ecocode.project.JavaFileInfo;
import com.ecocode.project.ProjectIndexer;

import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

/** Command-line prototype covering EcoCode Iterations 1-3. */
public class Main {
    public static void main(String[] args) {
        if (args.length < 1 || args.length > 2) {
            printUsage();
            return;
        }

        int detailsPerRule = 0;
        if (args.length == 2) {
            String detailsArg = args[1];
            if ("--details".equals(detailsArg)) {
                detailsPerRule = 5;
            } else if (detailsArg.startsWith("--details=")) {
                try {
                    detailsPerRule = Integer.parseInt(detailsArg.substring("--details=".length()));
                    if (detailsPerRule < 1) throw new NumberFormatException();
                } catch (NumberFormatException e) {
                    System.out.println("Invalid details count: " + detailsArg);
                    printUsage();
                    return;
                }
            } else {
                System.out.println("Unknown option: " + detailsArg);
                printUsage();
                return;
            }
        }

        Path projectPath = Path.of(args[0]).toAbsolutePath().normalize();
        ProjectIndexer indexer = new ProjectIndexer();
        List<JavaFileInfo> files = indexer.indexProject(projectPath);

        if (files.isEmpty()) {
            System.out.println("No Java files found under: " + projectPath);
            return;
        }

        JavaProjectParser parser = new JavaProjectParser();
        ProjectModel model = parser.parse(projectPath, files);

        SymbolSolver symbolSolver = new SymbolSolver();
        symbolSolver.resolveSymbols(model);
        CallGraph callGraph = CallGraph.buildFrom(model);

        RuleEngine ruleEngine = new RuleEngine(List.of(
                new EC101_RepeatedCallInLoop(),
                new EC102_StringConcatInLoop(),
                new EC103_CollectionLookupInLoop(),
                new EC104_UnboundedCollection(),
                new EC105_RepeatedAllocationHotPath(),
                new EC106_DeepCallChain(),
                new EC107_ResourceHandling(),
                new EC108_DuplicateComputation()
        ));
        List<StaticIssue> issues = ruleEngine.run(model, callGraph);

        long productionFiles = files.stream().filter(f -> !f.isTestFile()).count();
        long testFiles = files.size() - productionFiles;
        long totalLines = files.stream().mapToLong(JavaFileInfo::getLineCount).sum();
        int methodCount = model.getClasses().stream().mapToInt(c -> c.getMethods().size()).sum();

        System.out.println("\n===== ECOCODE — ITERATION 3 PROTOTYPE =====");
        System.out.println("Project:          " + projectPath);
        System.out.println("Java files:       " + files.size());
        System.out.println("Production files: " + productionFiles);
        System.out.println("Test files:       " + testFiles);
        System.out.println("Lines:            " + totalLines);
        System.out.println("Classes:          " + model.getClasses().size());
        System.out.println("Methods:          " + methodCount);
        System.out.println("Method calls:     " + model.getAllMethodCalls().size());
        System.out.println("Call-graph nodes: " + callGraph.getEdges().size());
        System.out.println("Parse warnings:   " + model.getParseWarnings().size());
        long productionFindings = issues.stream().filter(i -> !isTestIssue(i)).count();
        long testFindings = issues.size() - productionFindings;
        System.out.println("Static findings:  " + issues.size());
        System.out.println("  Production:      " + productionFindings);
        System.out.println("  Test code:       " + testFindings);

        System.out.println("\nIssues by rule:");
        for (EcoRule rule : List.of(
                new EC101_RepeatedCallInLoop(), new EC102_StringConcatInLoop(),
                new EC103_CollectionLookupInLoop(), new EC104_UnboundedCollection(),
                new EC105_RepeatedAllocationHotPath(), new EC106_DeepCallChain(),
                new EC107_ResourceHandling(), new EC108_DuplicateComputation())) {
            long count = issues.stream().filter(i -> rule.getRuleId().equals(i.getRuleId())).count();
            long prodCount = issues.stream().filter(i -> rule.getRuleId().equals(i.getRuleId()) && !isTestIssue(i)).count();
            System.out.printf("  %-5s %-40s %d (prod %d)%n", rule.getRuleId(), rule.getName(), count, prodCount);
        }

        if (!model.getParseWarnings().isEmpty()) {
            System.out.println("\nFirst parse warnings:");
            model.getParseWarnings().stream().limit(5).forEach(w -> System.out.println("  - " + w));
        }

        if (detailsPerRule > 0) {
            printIssueSamples(projectPath, issues, detailsPerRule);
        }
    }

    private static void printIssueSamples(Path projectPath, List<StaticIssue> issues, int detailsPerRule) {
        System.out.println("\n===== RULE CORRECTNESS AUDIT SAMPLES =====");
        System.out.println("Showing up to " + detailsPerRule + " finding(s) per rule.");

        List<String> ruleIds = List.of("EC101", "EC102", "EC103", "EC104", "EC105", "EC106", "EC107", "EC108");
        for (String ruleId : ruleIds) {
            List<StaticIssue> matching = issues.stream()
                    .filter(issue -> ruleId.equals(issue.getRuleId()))
                    .sorted(Comparator
                            .comparing((StaticIssue issue) -> safe(issue.getFileName()))
                            .thenComparing(issue -> issue.getLineNumber() == null ? Integer.MAX_VALUE : issue.getLineNumber()))
                    .toList();

            System.out.println("\n--- " + ruleId + " (" + matching.size() + " total) ---");
            if (matching.isEmpty()) {
                System.out.println("No findings.");
                continue;
            }

            matching.stream().limit(detailsPerRule).forEach(issue -> {
                System.out.println("File:           " + relativize(projectPath, issue.getFileName()));
                System.out.println("Line:           " + issue.getLineNumber());
                System.out.println("Class:          " + safe(issue.getClassName()));
                System.out.println("Method:         " + safe(issue.getMethodName()));
                System.out.println("Severity:       " + safe(issue.getSeverity()));
                System.out.println("Confidence:     " + safe(issue.getConfidence()));
                System.out.println("Call path:      " + safe(issue.getCallPath()));
                System.out.println("Explanation:    " + safe(issue.getExplanation()));
                System.out.println("Recommendation: " + safe(issue.getRecommendation()));
                System.out.println();
            });
        }
    }


    private static boolean isTestIssue(StaticIssue issue) {
        String file = issue.getFileName();
        if (file == null) return false;
        String normalized = file.replace('\\', '/');
        return normalized.contains("/src/test/") || normalized.contains("/test/");
    }
    private static String relativize(Path projectPath, String fileName) {
        if (fileName == null || fileName.isBlank()) return "<unknown>";
        try {
            Path file = Path.of(fileName).toAbsolutePath().normalize();
            if (file.startsWith(projectPath)) {
                return projectPath.relativize(file).toString();
            }
        } catch (Exception ignored) {
            // Reporting should never make analysis fail.
        }
        return fileName;
    }

    private static String safe(String value) {
        return value == null || value.isBlank() ? "<none>" : value;
    }

    private static void printUsage() {
        System.out.println("Usage:");
        System.out.println("  ./gradlew run --args=\"/path/to/java/project\"");
        System.out.println("  ./gradlew run --args=\"/path/to/java/project --details\"");
        System.out.println("  ./gradlew run --args=\"/path/to/java/project --details=10\"");
    }
}
