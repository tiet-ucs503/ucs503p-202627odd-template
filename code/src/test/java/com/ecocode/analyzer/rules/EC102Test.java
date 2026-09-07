package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class EC102Test {

    private EC102_StringConcatInLoop rule;

    @BeforeEach
    void setUp() {
        rule = new EC102_StringConcatInLoop();
    }

    @Test
    void givenStringConcatInLoop_thenDetected() {
        ProjectModel model = new ProjectModel("/tmp/test");
        model.getStringConcatsInLoop().add(
                new ProjectModel.StringConcatEvent("/tmp/StudentService.java", "com.example.StudentService", "buildReport", 25, "report = report + s.getName()")
        );

        List<StaticIssue> issues = rule.analyze(model, new CallGraph());

        assertEquals(1, issues.size());
        assertEquals("EC102", issues.get(0).getRuleId());
        assertEquals("MEDIUM", issues.get(0).getSeverity());
    }

    @Test
    void givenStringBuilderInLoop_thenNotDetected() {
        ProjectModel model = new ProjectModel("/tmp/test"); // empty string concats

        List<StaticIssue> issues = rule.analyze(model, new CallGraph());

        assertTrue(issues.isEmpty());
    }
}
