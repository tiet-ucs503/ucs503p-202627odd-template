package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.ClassInfo;
import com.ecocode.analyzer.MethodInfo;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class EC106_DeepCallChain implements EcoRule {

    @Override
    public String getRuleId() { return "EC106"; }

    @Override
    public String getName() { return "Deep Call Chain"; }

    @Override
    public String getDescription() {
        return "A public method has a long reachable call chain in the prototype call graph. This is primarily a maintainability/complexity signal.";
    }

    @Override
    public String getSeverity() { return "LOW"; }

    @Override
    public List<StaticIssue> analyze(ProjectModel model, CallGraph callGraph) {
        List<StaticIssue> issues = new ArrayList<>();
        Set<String> reportedMethodIds = new HashSet<>();

        for (ClassInfo cls : model.getClasses()) {
            if (cls.isTestClass()) continue;

            for (MethodInfo method : cls.getMethods()) {
                if (!method.isPublic()) continue;

                String fullMethodId = cls.getQualifiedName() + "#" + method.getName();
                if (!reportedMethodIds.add(fullMethodId)) continue;

                int depth = callGraph.getReachabilityDepth(fullMethodId);
                if (depth <= 8) continue;

                StaticIssue issue = new StaticIssue();
                issue.setRuleId(getRuleId());
                issue.setSeverity(getSeverity());
                issue.setConfidence("LOW");
                issue.setFileName(cls.getFilePath());
                issue.setLineNumber(method.getStartLine());
                issue.setClassName(cls.getQualifiedName());
                issue.setMethodName(method.getName());
                issue.setCallPath(fullMethodId + " (prototype depth=" + depth + ")");
                issue.setExplanation("Prototype call-graph depth from public method '" + method.getName() + "' is " + depth + " (review threshold: 8).");
                issue.setRecommendation("Review whether the delegation depth reflects unnecessary indirection. Do not refactor solely on this signal.");
                issue.setTradeOffs("Deeper layering can be intentional; the current call graph is method-name-level and may merge overloads.");
                issues.add(issue);
            }
        }

        return issues;
    }
}
