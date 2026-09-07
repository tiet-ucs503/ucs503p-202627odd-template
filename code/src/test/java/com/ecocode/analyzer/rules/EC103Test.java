package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.MethodCallInfo;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class EC103Test {

    private EC103_CollectionLookupInLoop rule;

    @BeforeEach
    void setUp() {
        rule = new EC103_CollectionLookupInLoop();
    }

    @Test
    void givenListContainsInLoop_thenDetected() {
        ProjectModel model = new ProjectModel("/tmp/test");
        MethodCallInfo call = new MethodCallInfo(
                "contains", "eligibleIdsList", List.of("s.getId()"), 30, true,
                "com.example.StudentService", "filterEligible", "/tmp/StudentService.java"
        );
        model.getAllMethodCalls().add(call);

        List<StaticIssue> issues = rule.analyze(model, new CallGraph());

        assertEquals(1, issues.size());
        assertEquals("EC103", issues.get(0).getRuleId());
        assertEquals("MEDIUM", issues.get(0).getSeverity());
    }

    @Test
    void givenSetContainsInLoop_thenNotDetected() {
        ProjectModel model = new ProjectModel("/tmp/test");
        MethodCallInfo call = new MethodCallInfo(
                "contains", "eligibleSet", List.of("s.getId()"), 30, true,
                "com.example.StudentService", "filterEligible", "/tmp/StudentService.java"
        );
        model.getAllMethodCalls().add(call);

        List<StaticIssue> issues = rule.analyze(model, new CallGraph());

        assertTrue(issues.isEmpty());
    }
}
