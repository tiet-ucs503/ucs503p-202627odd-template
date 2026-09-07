package com.ecocode.analyzer.rules;

import com.ecocode.analyzer.CallGraph;
import com.ecocode.analyzer.ProjectModel;
import com.ecocode.model.StaticIssue;

import java.util.List;

public interface EcoRule {
    String getRuleId();
    String getName();
    String getDescription();
    String getSeverity(); // "HIGH", "MEDIUM", "LOW"
    List<StaticIssue> analyze(ProjectModel model, CallGraph callGraph);
}
