package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;

import java.util.ArrayList;
import java.util.List;

public class EC102_StringConcatInLoop implements EcoRule {

    @Override
    public String getRuleId() { return "EC102"; }

    @Override
    public String getName() { return "Accumulating String Concatenation in Loop"; }

    @Override
    public String getDescription() {
        return "A String value is repeatedly accumulated inside a loop, which can create many temporary String objects.";
    }

    @Override
    public String getSeverity() { return "MEDIUM"; }

    @Override
    public List<StaticIssue> analyze(ProjectModel model, CallGraph callGraph) {
        List<StaticIssue> issues = new ArrayList<>();

        for (ProjectModel.StringConcatEvent event : model.getStringConcatsInLoop()) {
            StaticIssue issue = new StaticIssue();
            issue.setRuleId(getRuleId());
            issue.setSeverity(getSeverity());
            issue.setConfidence("HIGH");
            issue.setFileName(event.filePath);
            issue.setLineNumber(event.lineNumber);
            issue.setClassName(event.className);
            issue.setMethodName(event.methodName);
            issue.setCallPath(event.className + "#" + event.methodName);
            issue.setExplanation("Accumulating String concatenation inside loop at line " + event.lineNumber + ": " + event.expression);
            issue.setRecommendation("Use StringBuilder/StringJoiner when the same String is accumulated across iterations.");
            issue.setTradeOffs("The alternative is slightly more verbose but avoids repeatedly copying the accumulated String contents.");
            issues.add(issue);
        }

        return issues;
    }
}
