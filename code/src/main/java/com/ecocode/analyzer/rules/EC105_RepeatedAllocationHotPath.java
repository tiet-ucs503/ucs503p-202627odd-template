package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;

import java.util.ArrayList;
import java.util.List;

public class EC105_RepeatedAllocationHotPath implements EcoRule {

    @Override
    public String getRuleId() { return "EC105"; }

    @Override
    public String getName() { return "Potential Repeated Allocation in Loop"; }

    @Override
    public String getDescription() {
        return "An object with constant/empty constructor arguments is allocated inside a loop. This is a review signal, not proof that reuse is safe.";
    }

    @Override
    public String getSeverity() { return "LOW"; }

    @Override
    public List<StaticIssue> analyze(ProjectModel model, CallGraph callGraph) {
        List<StaticIssue> issues = new ArrayList<>();

        for (ProjectModel.ObjectCreationEvent event : model.getObjectCreationsInLoop()) {
            if (isExceptionType(event.typeName)) continue;

            boolean isConstantOrEmpty = event.arguments.isEmpty() || event.arguments.stream()
                    .allMatch(arg -> arg.matches("\".*\"") || arg.matches("-?\\d+(\\.\\d+)?") ||
                            arg.equals("true") || arg.equals("false") || arg.equals("null"));

            if (!isConstantOrEmpty) continue;

            StaticIssue issue = new StaticIssue();
            issue.setRuleId(getRuleId());
            issue.setSeverity(getSeverity());
            issue.setConfidence("LOW");
            issue.setFileName(event.filePath);
            issue.setLineNumber(event.lineNumber);
            issue.setClassName(event.className);
            issue.setMethodName(event.methodName);
            issue.setCallPath(event.className + "#" + event.methodName + " -> new " + event.typeName + "()");
            issue.setExplanation("Object allocation 'new " + event.typeName + "(...)' occurs inside a loop at line " + event.lineNumber + " with constant/empty constructor arguments.");
            issue.setRecommendation("Profile this path first. Reuse or hoist the object only if object state and program semantics make that safe.");
            issue.setTradeOffs("Reusing mutable objects can be incorrect; this rule is intentionally a low-confidence review signal.");
            issues.add(issue);
        }

        return issues;
    }

    private boolean isExceptionType(String typeName) {
        return typeName != null && (typeName.endsWith("Exception") || typeName.endsWith("Error"));
    }
}
