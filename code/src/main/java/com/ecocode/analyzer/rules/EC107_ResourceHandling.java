package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;

import java.util.ArrayList;
import java.util.List;

public class EC107_ResourceHandling implements EcoRule {

    @Override
    public String getRuleId() { return "EC107"; }

    @Override
    public String getName() { return "Potential Unclosed System Resource"; }

    @Override
    public String getDescription() {
        return "A known external resource type is declared without try-with-resources and no explicit close() call is visible in the same method.";
    }

    @Override
    public String getSeverity() { return "HIGH"; }

    @Override
    public List<StaticIssue> analyze(ProjectModel model, CallGraph callGraph) {
        List<StaticIssue> issues = new ArrayList<>();

        for (ProjectModel.ResourceHandlingEvent event : model.getUnclosedResources()) {
            StaticIssue issue = new StaticIssue();
            issue.setRuleId(getRuleId());
            issue.setSeverity(getSeverity());
            issue.setConfidence("MEDIUM");
            issue.setFileName(event.filePath);
            issue.setLineNumber(event.lineNumber);
            issue.setClassName(event.className);
            issue.setMethodName(event.methodName);
            issue.setCallPath(event.className + "#" + event.methodName + " (" + event.resourceType + " " + event.variableName + ")");
            issue.setExplanation("Resource '" + event.variableName + "' of type " + event.resourceType + " at line " + event.lineNumber + " has no try-with-resources or visible close() call in the same method.");
            issue.setRecommendation("Prefer try-with-resources where ownership belongs to this method; otherwise verify and document where the resource is closed.");
            issue.setTradeOffs("Resource ownership can be transferred to wrappers/callees, so this remains a static review finding rather than proof of a leak.");
            issues.add(issue);
        }

        return issues;
    }
}
