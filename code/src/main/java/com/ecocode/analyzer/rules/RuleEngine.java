package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;

import java.util.*;

public class RuleEngine {

    private final List<EcoRule> rules;

    public RuleEngine(List<EcoRule> rules) {
        this.rules = rules != null ? rules : Collections.emptyList();
    }

    public List<StaticIssue> run(ProjectModel model, CallGraph callGraph) {
        List<StaticIssue> allIssues = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();

        for (EcoRule rule : rules) {
            try {
                List<StaticIssue> detected = rule.analyze(model, callGraph);
                for (StaticIssue issue : detected) {
                    String dedupeKey = issue.getRuleId() + ":" + issue.getFileName() + ":" + issue.getLineNumber();
                    if (!seenKeys.contains(dedupeKey)) {
                        seenKeys.add(dedupeKey);
                        allIssues.add(issue);
                    }
                }
            } catch (Exception e) {
                System.err.println("Rule " + rule.getRuleId() + " failed during execution: " + e.getMessage());
            }
        }

        return allIssues;
    }
}
