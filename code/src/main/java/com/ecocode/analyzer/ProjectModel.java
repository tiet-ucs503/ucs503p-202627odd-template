package com.ecocode.analyzer;

import java.util.ArrayList;
import java.util.List;

public class ProjectModel {
    private String projectPath;
    private List<ClassInfo> classes = new ArrayList<>();
    private List<MethodCallInfo> allMethodCalls = new ArrayList<>();

    // Additional detected AST structures for special rule checks
    private List<StringConcatEvent> stringConcatsInLoop = new ArrayList<>();
    private List<ObjectCreationEvent> objectCreationsInLoop = new ArrayList<>();
    private List<ResourceHandlingEvent> unclosedResources = new ArrayList<>();
    private List<String> parseWarnings = new ArrayList<>();

    public ProjectModel() {}

    public ProjectModel(String projectPath) {
        this.projectPath = projectPath;
    }

    public String getProjectPath() { return projectPath; }
    public void setProjectPath(String projectPath) { this.projectPath = projectPath; }

    public List<ClassInfo> getClasses() { return classes; }
    public void setClasses(List<ClassInfo> classes) { this.classes = classes; }

    public List<MethodCallInfo> getAllMethodCalls() { return allMethodCalls; }
    public void setAllMethodCalls(List<MethodCallInfo> allMethodCalls) { this.allMethodCalls = allMethodCalls; }

    public List<StringConcatEvent> getStringConcatsInLoop() { return stringConcatsInLoop; }
    public void setStringConcatsInLoop(List<StringConcatEvent> stringConcatsInLoop) { this.stringConcatsInLoop = stringConcatsInLoop; }

    public List<ObjectCreationEvent> getObjectCreationsInLoop() { return objectCreationsInLoop; }
    public void setObjectCreationsInLoop(List<ObjectCreationEvent> objectCreationsInLoop) { this.objectCreationsInLoop = objectCreationsInLoop; }

    public List<ResourceHandlingEvent> getUnclosedResources() { return unclosedResources; }
    public void setUnclosedResources(List<ResourceHandlingEvent> unclosedResources) { this.unclosedResources = unclosedResources; }

    public List<String> getParseWarnings() { return parseWarnings; }
    public void setParseWarnings(List<String> parseWarnings) { this.parseWarnings = parseWarnings; }

    public static class StringConcatEvent {
        public String filePath;
        public String className;
        public String methodName;
        public int lineNumber;
        public String expression;

        public StringConcatEvent(String filePath, String className, String methodName, int lineNumber, String expression) {
            this.filePath = filePath;
            this.className = className;
            this.methodName = methodName;
            this.lineNumber = lineNumber;
            this.expression = expression;
        }
    }

    public static class ObjectCreationEvent {
        public String filePath;
        public String className;
        public String methodName;
        public int lineNumber;
        public String typeName;
        public List<String> arguments;

        public ObjectCreationEvent(String filePath, String className, String methodName, int lineNumber, String typeName, List<String> arguments) {
            this.filePath = filePath;
            this.className = className;
            this.methodName = methodName;
            this.lineNumber = lineNumber;
            this.typeName = typeName;
            this.arguments = arguments != null ? arguments : new ArrayList<>();
        }
    }

    public static class ResourceHandlingEvent {
        public String filePath;
        public String className;
        public String methodName;
        public int lineNumber;
        public String resourceType;
        public String variableName;

        public ResourceHandlingEvent(String filePath, String className, String methodName, int lineNumber, String resourceType, String variableName) {
            this.filePath = filePath;
            this.className = className;
            this.methodName = methodName;
            this.lineNumber = lineNumber;
            this.resourceType = resourceType;
            this.variableName = variableName;
        }
    }
}
