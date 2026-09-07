package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.MethodCallInfo;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;

import java.util.ArrayList;
import java.util.List;

public class EC103_CollectionLookupInLoop implements EcoRule {

    @Override
    public String getRuleId() { return "EC103"; }

    @Override
    public String getName() { return "Linear Collection Lookup in Loop"; }

    @Override
    public String getDescription() {
        return "Potential List.contains()/indexOf() lookup is performed repeatedly inside a loop, creating repeated linear scans.";
    }

    @Override
    public String getSeverity() { return "MEDIUM"; }

    @Override
    public List<StaticIssue> analyze(ProjectModel model, CallGraph callGraph) {
        List<StaticIssue> issues = new ArrayList<>();

        for (MethodCallInfo call : model.getAllMethodCalls()) {
            if (!call.isInLoop()) continue;

            String callee = call.getCalleeName();
            if (!"contains".equals(callee) && !"indexOf".equals(callee)) continue;

            String scope = call.getScope() != null ? call.getScope() : "";
            String lowerScope = scope.toLowerCase();
            boolean looksLikeSet = lowerScope.contains("set");
            boolean looksLikeLinearCollection = lowerScope.contains("list") || lowerScope.contains("ids") || lowerScope.contains("collection");
            if (looksLikeSet || !looksLikeLinearCollection) continue;

            StaticIssue issue = new StaticIssue();
            issue.setRuleId(getRuleId());
            issue.setSeverity(getSeverity());
            issue.setConfidence("MEDIUM");
            issue.setFileName(call.getFilePath());
            issue.setLineNumber(call.getLineNumber());
            issue.setClassName(call.getCallerClassName());
            issue.setMethodName(call.getCallerMethodName());
            issue.setCallPath(call.getCallerFullMethodId() + " -> " + scope + "." + callee + "()");
            issue.setExplanation("Potential linear lookup '" + scope + "." + callee + "()' occurs inside a loop at line " + call.getLineNumber() + ".");
            if ("contains".equals(callee)) {
                issue.setRecommendation("If membership testing is the intent, consider building a HashSet before the loop.");
            } else {
                issue.setRecommendation("If repeated index lookup is required, consider a value-to-index map or another indexed structure; preserve index semantics.");
            }
            issue.setTradeOffs("Faster lookup usually requires additional memory and may change ordering/index semantics.");
            issues.add(issue);
        }

        return issues;
    }
}
