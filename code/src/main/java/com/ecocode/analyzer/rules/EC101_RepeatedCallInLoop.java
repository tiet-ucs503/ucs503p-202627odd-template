package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.MethodCallInfo;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;

import java.util.ArrayList;
import java.util.List;

public class EC101_RepeatedCallInLoop implements EcoRule {

    @Override
    public String getRuleId() { return "EC101"; }

    @Override
    public String getName() { return "Repeated Database Call in Loop"; }

    @Override
    public String getDescription() {
        return "Potential database/repository access is executed inside a loop, which may create N+1 style repeated I/O.";
    }

    @Override
    public String getSeverity() { return "HIGH"; }

    @Override
    public List<StaticIssue> analyze(ProjectModel model, CallGraph callGraph) {
        List<StaticIssue> issues = new ArrayList<>();

        for (MethodCallInfo call : model.getAllMethodCalls()) {
            if (!call.isInLoop()) continue;
            if (!isDatabaseMethod(call, model, callGraph)) continue;

            StaticIssue issue = new StaticIssue();
            issue.setRuleId(getRuleId());
            issue.setSeverity(getSeverity());
            issue.setConfidence("MEDIUM");
            issue.setFileName(call.getFilePath());
            issue.setLineNumber(call.getLineNumber());
            issue.setClassName(call.getCallerClassName());
            issue.setMethodName(call.getCallerMethodName());
            issue.setCallPath(call.getCallerFullMethodId() + " -> " + call.getCalleeName());
            issue.setExplanation("Potential repository/database call '" + call.getCalleeName() + "' occurs inside a loop at line " + call.getLineNumber() + ".");
            issue.setRecommendation("Verify whether this call performs I/O. If it does, consider batching or prefetching data before the loop.");
            issue.setTradeOffs("Batching can reduce I/O roundtrips but may increase temporary memory use and change query shape.");
            issues.add(issue);
        }

        return issues;
    }

    private static final List<String> DB_CLASS_PATTERNS = List.of(
            "Repository", "Dao", "DAO", "JdbcTemplate", "EntityManager",
            "CrudRepository", "JpaRepository", "MongoRepository", "RedisTemplate"
    );

    private boolean isDatabaseMethod(MethodCallInfo call, ProjectModel model, CallGraph callGraph) {
        String scope = call.getScope();
        String target = call.getResolvedTarget();

        if (matchesDbClass(scope)) return true;

        // Direct field-scope evidence: repo.findById(...) where the caller class
        // declares `repo` as StudentRepository / SomeDao / etc.
        if (scope != null) {
            boolean databaseFieldScope = model.getClasses().stream()
                    .filter(c -> c.getQualifiedName().equals(call.getCallerClassName()))
                    .map(c -> c.getFieldTypes().get(scope))
                    .filter(this::matchesDbClass)
                    .findFirst()
                    .map(type -> {
                        call.setResolvedTarget(type + "#" + call.getCalleeName());
                        return true;
                    })
                    .orElse(false);

            if (databaseFieldScope) return true;
        }

        if (target != null) {
            String targetClass = target.contains("#") ? target.substring(0, target.indexOf('#')) : target;
            if (matchesDbClass(targetClass)) return true;
        }

        // Conservative transitive check: only class identity is considered evidence.
        return callGraph.reachableFrom(call.getCallerFullMethodId()).stream()
                .map(node -> node.contains("#") ? node.substring(0, node.indexOf('#')) : node)
                .anyMatch(this::matchesDbClass);
    }

    private boolean matchesDbClass(String value) {
        if (value == null || value.isBlank()) return false;
        return DB_CLASS_PATTERNS.stream().anyMatch(value::contains);
    }
}
