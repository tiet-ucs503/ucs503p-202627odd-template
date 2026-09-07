package com.ecocode.analyzer;

import java.util.ArrayList;
import java.util.List;

public class MethodInfo {
    private String name;
    private String returnType;
    private List<String> parameterTypes = new ArrayList<>();
    private List<String> parameterNames = new ArrayList<>();
    private int startLine;
    private int endLine;
    private boolean isPublic;
    private List<MethodCallInfo> calls = new ArrayList<>();

    public MethodInfo() {}

    public MethodInfo(String name, String returnType, List<String> parameterTypes,
                      List<String> parameterNames, int startLine, int endLine, boolean isPublic) {
        this.name = name;
        this.returnType = returnType;
        this.parameterTypes = parameterTypes != null ? parameterTypes : new ArrayList<>();
        this.parameterNames = parameterNames != null ? parameterNames : new ArrayList<>();
        this.startLine = startLine;
        this.endLine = endLine;
        this.isPublic = isPublic;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getReturnType() { return returnType; }
    public void setReturnType(String returnType) { this.returnType = returnType; }

    public List<String> getParameterTypes() { return parameterTypes; }
    public void setParameterTypes(List<String> parameterTypes) { this.parameterTypes = parameterTypes; }

    public List<String> getParameterNames() { return parameterNames; }
    public void setParameterNames(List<String> parameterNames) { this.parameterNames = parameterNames; }

    public int getStartLine() { return startLine; }
    public void setStartLine(int startLine) { this.startLine = startLine; }

    public int getEndLine() { return endLine; }
    public void setEndLine(int endLine) { this.endLine = endLine; }

    public boolean isPublic() { return isPublic; }
    public void setPublic(boolean isPublic) { this.isPublic = isPublic; }

    public List<MethodCallInfo> getCalls() { return calls; }
    public void setCalls(List<MethodCallInfo> calls) { this.calls = calls; }
}
