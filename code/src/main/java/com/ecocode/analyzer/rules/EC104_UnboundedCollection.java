package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.MethodCallInfo;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;

import java.util.ArrayList;
import java.util.List;

public class EC104_UnboundedCollection implements EcoRule {

    @Override
    public String getRuleId() { return "EC104"; }

    @Override
    public String getName() { return "Unbounded Collection Fetch"; }

    @Override
    public String getDescription() {
        return "Invokes repo.findAll() without pagination (Pageable argument), risking OutOfMemoryError and excessive DB payload transfer.";
    }

    @Override
    public String getSeverity() { return "HIGH"; }

    @Override
    public List<StaticIssue> analyze(ProjectModel model, CallGraph callGraph) {
        List<StaticIssue> issues = new ArrayList<>();

        for (MethodCallInfo call : model.getAllMethodCalls()) {
            if ("findAll".equals(call.getCalleeName())) {
                boolean hasPageableArg = call.getArguments().stream()
                        .anyMatch(arg -> arg.toLowerCase().contains("page") || arg.toLowerCase().contains("pageable"));

                if (!hasPageableArg && call.getArguments().isEmpty()) {
                    StaticIssue issue = new StaticIssue();
                    issue.setRuleId(getRuleId());
                    issue.setSeverity(getSeverity());
                    issue.setConfidence("HIGH");
                    issue.setFileName(call.getFilePath());
                    issue.setLineNumber(call.getLineNumber());
                    issue.setClassName(call.getCallerClassName());
                    issue.setMethodName(call.getCallerMethodName());
                    issue.setCallPath(call.getCallerFullMethodId() + " -> repo.findAll()");
                    issue.setExplanation("Call to repo.findAll() without pagination parameters at line " + call.getLineNumber() + ".");
                    issue.setRecommendation("Accept a Pageable parameter and pass it to repo.findAll(pageable).");
                    issue.setTradeOffs("Requires handling paginated UI/API consumers, but caps maximum memory consumption.");
                    issues.add(issue);
                }
            }
        }

        return issues;
    }
}
