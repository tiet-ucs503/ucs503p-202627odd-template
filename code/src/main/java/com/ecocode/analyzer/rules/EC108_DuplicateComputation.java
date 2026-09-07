package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.ClassInfo;
import com.ecocode.analyzer.MethodCallInfo;
import com.ecocode.analyzer.MethodInfo;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;

import java.util.*;

public class EC108_DuplicateComputation implements EcoRule {

    private static final Set<String> EXCLUDED_METHODS = Set.of(
            "add", "get", "append", "print", "println",
            "next", "previous", "read", "readLine", "write", "remove", "delete",
            "poll", "pop", "push", "offer", "take", "put",
            "iterator", "listIterator", "stream",
            "currentTimeMillis", "nanoTime", "random",
            "flush", "close", "commit", "rollback", "display"
    );

    @Override
    public String getRuleId() { return "EC108"; }

    @Override
    public String getName() { return "Potential Duplicate Computation"; }

    @Override
    public String getDescription() {
        return "The same scoped method call with the same textual arguments appears multiple times in one method. Purity is not proven.";
    }

    @Override
    public String getSeverity() { return "MEDIUM"; }

    @Override
    public List<StaticIssue> analyze(ProjectModel model, CallGraph callGraph) {
        List<StaticIssue> issues = new ArrayList<>();

        for (ClassInfo cls : model.getClasses()) {
            for (MethodInfo method : cls.getMethods()) {
                Map<String, List<MethodCallInfo>> callGroups = new HashMap<>();

                for (MethodCallInfo call : method.getCalls()) {
                    String callee = call.getCalleeName();
                    if (callee == null || EXCLUDED_METHODS.contains(callee)) continue;

                    String scope = call.getScope() == null ? "<implicit>" : call.getScope().trim();
                    String key = scope + "." + callee + "(" + String.join(",", call.getArguments()) + ")";
                    callGroups.computeIfAbsent(key, k -> new ArrayList<>()).add(call);
                }

                for (Map.Entry<String, List<MethodCallInfo>> entry : callGroups.entrySet()) {
                    if (entry.getValue().size() < 2) continue;

                    MethodCallInfo firstCall = entry.getValue().get(0);
                    StaticIssue issue = new StaticIssue();
                    issue.setRuleId(getRuleId());
                    issue.setSeverity(getSeverity());
                    issue.setConfidence("MEDIUM");
                    issue.setFileName(firstCall.getFilePath());
                    issue.setLineNumber(firstCall.getLineNumber());
                    issue.setClassName(cls.getQualifiedName());
                    issue.setMethodName(method.getName());
                    issue.setCallPath(cls.getQualifiedName() + "#" + method.getName() + " -> " + entry.getKey());
                    issue.setExplanation("Potentially duplicate call '" + entry.getKey() + "' appears " + entry.getValue().size() + " times inside method '" + method.getName() + "'.");
                    issue.setRecommendation("If the call is pure and no relevant state changes between invocations, consider caching the result in a local variable.");
                    issue.setTradeOffs("Caching a stateful or side-effecting call can change behavior; purity/state analysis is not yet implemented.");
                    issues.add(issue);
                }
            }
        }

        return issues;
    }
}
