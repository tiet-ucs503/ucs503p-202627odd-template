package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.JavaProjectParser;
import com.ecocode.analyzer.MethodCallInfo;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.analyzer.TestFixtures;
import com.ecocode.model.StaticIssue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class EC101Test {

    @TempDir
    Path tempDir;

    private EC101_RepeatedCallInLoop rule;

    @BeforeEach
    void setUp() {
        rule = new EC101_RepeatedCallInLoop();
    }

    @Test
    void givenDatabaseCallInLoop_thenEC101Detected() throws Exception {
        Files.writeString(tempDir.resolve("InefficientService.java"), TestFixtures.INEFFICIENT);
        ProjectModel model = new JavaProjectParser().parse(tempDir);
        List<StaticIssue> issues = rule.analyze(model, new CallGraph());
        assertTrue(issues.stream().anyMatch(i -> i.getRuleId().equals("EC101")));
    }

    @Test
    void givenNoLoopDBCall_thenNothingDetected() throws Exception {
        Files.writeString(tempDir.resolve("EfficientService.java"), TestFixtures.EFFICIENT);
        ProjectModel model = new JavaProjectParser().parse(tempDir);
        List<StaticIssue> issues = rule.analyze(model, new CallGraph());
        assertTrue(issues.isEmpty());
    }

    @Test
    void givenDatabaseCallReachableFromLoop_whenRuleRuns_thenEC101Detected() {
        ProjectModel model = new ProjectModel(tempDir != null ? tempDir.toString() : "/tmp/test");
        MethodCallInfo callInLoop = new MethodCallInfo(
                "findById", "studentRepo", List.of("id"), 15, true,
                "com.example.StudentService", "getStudentCourseNames", "/tmp/StudentService.java"
        );
        callInLoop.setResolvedTarget("com.example.StudentRepository#findById");
        model.getAllMethodCalls().add(callInLoop);

        CallGraph graph = CallGraph.buildFrom(model);

        List<StaticIssue> issues = rule.analyze(model, graph);

        assertEquals(1, issues.size());
        assertEquals("EC101", issues.get(0).getRuleId());
        assertEquals("HIGH", issues.get(0).getSeverity());
    }

    @Test
    void givenDatabaseCallOutsideLoop_whenRuleRuns_thenNothingDetected() {
        ProjectModel model = new ProjectModel(tempDir != null ? tempDir.toString() : "/tmp/test");
        MethodCallInfo callOutsideLoop = new MethodCallInfo(
                "findById", "studentRepo", List.of("id"), 15, false,
                "com.example.StudentService", "getStudentCourseNames", "/tmp/StudentService.java"
        );
        model.getAllMethodCalls().add(callOutsideLoop);

        CallGraph graph = CallGraph.buildFrom(model);

        List<StaticIssue> issues = rule.analyze(model, graph);

        assertTrue(issues.isEmpty());
    }

    @Test
    void givenOrdinaryCallInsideLoop_whenRuleRuns_thenNothingDetected() {
        ProjectModel model = new ProjectModel(tempDir != null ? tempDir.toString() : "/tmp/test");
        MethodCallInfo ordinaryCall = new MethodCallInfo(
                "getName", "student", List.of(), 20, true,
                "com.example.StudentService", "process", "/tmp/StudentService.java"
        );
        model.getAllMethodCalls().add(ordinaryCall);

        CallGraph graph = CallGraph.buildFrom(model);

        List<StaticIssue> issues = rule.analyze(model, graph);

        assertTrue(issues.isEmpty());
    }
    @Test
    void givenResolvedOrdinaryCallInsideLoop_whenRuleRuns_thenNothingDetected() {
        ProjectModel model = new ProjectModel(tempDir != null ? tempDir.toString() : "/tmp/test");
        MethodCallInfo callInLoop = new MethodCallInfo(
                "value", "helper", List.of(), 20, true,
                "com.example.Service", "process", "/tmp/Service.java"
        );
        callInLoop.setResolvedTarget("com.example.ValueHelper#value");
        model.getAllMethodCalls().add(callInLoop);

        CallGraph graph = CallGraph.buildFrom(model);

        List<StaticIssue> issues = rule.analyze(model, graph);

        assertTrue(issues.isEmpty());
    }

}
