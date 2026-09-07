package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.ClassInfo;
import com.ecocode.analyzer.MethodCallInfo;
import com.ecocode.analyzer.MethodInfo;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EC108Test {

    @Test
    void repeatedReadLineIsExcludedBecauseItIsStateful() {
        ProjectModel model = singleMethodModel(List.of(
                call("readLine", "reader", 10),
                call("readLine", "reader", 11)
        ));

        List<StaticIssue> findings = new EC108_DuplicateComputation().analyze(model, CallGraph.buildFrom(model));

        assertTrue(findings.isEmpty());
    }

    @Test
    void identicalCallsOnDifferentScopesAreNotGroupedTogether() {
        ProjectModel model = singleMethodModel(List.of(
                call("getName", "left", 10),
                call("getName", "right", 11)
        ));

        List<StaticIssue> findings = new EC108_DuplicateComputation().analyze(model, CallGraph.buildFrom(model));

        assertTrue(findings.isEmpty());
    }

    @Test
    void repeatedAccessorOnSameScopeIsReportedAsPotentialDuplicate() {
        ProjectModel model = singleMethodModel(List.of(
                call("getName", "student", 10),
                call("getName", "student", 11)
        ));

        List<StaticIssue> findings = new EC108_DuplicateComputation().analyze(model, CallGraph.buildFrom(model));

        assertEquals(1, findings.size());
        assertEquals("EC108", findings.get(0).getRuleId());
    }

    private static MethodCallInfo call(String name, String scope, int line) {
        return new MethodCallInfo(name, scope, List.of(), line, false,
                "com.example.Service", "process", "/tmp/Service.java");
    }

    private static ProjectModel singleMethodModel(List<MethodCallInfo> calls) {
        ProjectModel model = new ProjectModel("/tmp/test");
        ClassInfo cls = new ClassInfo("Service", "com.example.Service", "com.example", "/tmp/Service.java", false);
        MethodInfo method = new MethodInfo("process", "void", List.of(), List.of(), 1, 1, true);
        method.getCalls().addAll(calls);
        cls.getMethods().add(method);
        model.getClasses().add(cls);
        model.getAllMethodCalls().addAll(calls);
        return model;
    }
}
