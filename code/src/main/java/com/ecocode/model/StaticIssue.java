package com.ecocode.model;

/**
 * One deterministic static-analysis finding produced by an EcoCode rule.
 * This prototype keeps findings in memory; persistence belongs to a later iteration.
 */
public class StaticIssue {
    private String ruleId;
    private String severity;
    private String confidence = "MEDIUM";
    private String fileName;
    private Integer lineNumber;
    private String className;
    private String methodName;
    private String callPath;
    private String explanation;
    private String recommendation;
    private String tradeOffs;

    public String getRuleId() { return ruleId; }
    public void setRuleId(String ruleId) { this.ruleId = ruleId; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getConfidence() { return confidence; }
    public void setConfidence(String confidence) { this.confidence = confidence; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public Integer getLineNumber() { return lineNumber; }
    public void setLineNumber(Integer lineNumber) { this.lineNumber = lineNumber; }
    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }
    public String getMethodName() { return methodName; }
    public void setMethodName(String methodName) { this.methodName = methodName; }
    public String getCallPath() { return callPath; }
    public void setCallPath(String callPath) { this.callPath = callPath; }
    public String getExplanation() { return explanation; }
    public void setExplanation(String explanation) { this.explanation = explanation; }
    public String getRecommendation() { return recommendation; }
    public void setRecommendation(String recommendation) { this.recommendation = recommendation; }
    public String getTradeOffs() { return tradeOffs; }
    public void setTradeOffs(String tradeOffs) { this.tradeOffs = tradeOffs; }
}
