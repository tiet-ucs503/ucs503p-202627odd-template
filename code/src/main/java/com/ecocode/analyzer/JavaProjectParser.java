package com.ecocode.analyzer;

import com.ecocode.project.JavaFileInfo;
import com.ecocode.project.ProjectIndexer;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node;
import com.github.javaparser.ast.body.ClassOrInterfaceDeclaration;
import com.github.javaparser.ast.body.FieldDeclaration;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.VariableDeclarator;
import com.github.javaparser.ast.expr.*;
import com.github.javaparser.ast.stmt.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Iteration 1-3 parser. ProjectIndexer discovers files; this class turns Java
 * source into EcoCode's project model and records AST events used by rules.
 */
public class JavaProjectParser {

    private static final Set<String> RESOURCE_TYPES = Set.of(
            "InputStream", "FileInputStream", "BufferedInputStream",
            "OutputStream", "FileOutputStream", "BufferedOutputStream",
            "Reader", "BufferedReader", "FileReader", "Writer", "BufferedWriter", "FileWriter",
            "Connection", "Statement", "PreparedStatement", "ResultSet"
    );

    public ProjectModel parseProject(String projectPath) {
        return parse(Paths.get(projectPath));
    }

    /** Convenience entry point used by tests and the CLI. */
    public ProjectModel parse(Path projectRoot) {
        if (!Files.exists(projectRoot)) {
            throw new IllegalArgumentException("Project root not found: " + projectRoot);
        }

        ProjectIndexer indexer = new ProjectIndexer();
        List<JavaFileInfo> files = indexer.indexProject(projectRoot);
        if (files.isEmpty()) {
            throw new IllegalArgumentException("No .java files found in: " + projectRoot);
        }
        return parse(projectRoot, files);
    }

    /** Uses the already-indexed files so filesystem discovery is not duplicated. */
    public ProjectModel parse(Path projectRoot, List<JavaFileInfo> files) {
        ProjectModel model = new ProjectModel(projectRoot.toAbsolutePath().toString());
        for (JavaFileInfo file : files) {
            parseFile(file, model);
        }
        return model;
    }

    public void parseFile(JavaFileInfo fileInfo, ProjectModel model) {
        try {
            CompilationUnit cu = StaticJavaParser.parse(fileInfo.getPath());
            String packageName = cu.getPackageDeclaration()
                    .map(pd -> pd.getNameAsString())
                    .orElse("");

            for (ClassOrInterfaceDeclaration classDecl : cu.findAll(ClassOrInterfaceDeclaration.class)) {
                String simpleName = classDecl.getNameAsString();
                String nestedName = buildNestedClassName(classDecl);
                String qualifiedName = packageName.isEmpty() ? nestedName : packageName + "." + nestedName;

                ClassInfo classInfo = new ClassInfo(
                        qualifiedName,
                        simpleName,
                        packageName,
                        fileInfo.getPath().toAbsolutePath().toString(),
                        fileInfo.isTestFile()
                );

                boolean isRepo = simpleName.contains("Repository") || simpleName.contains("Dao") ||
                        simpleName.contains("JdbcTemplate") || simpleName.contains("EntityManager") ||
                        classDecl.isAnnotationPresent("Repository");
                classInfo.setRepositoryOrDao(isRepo);

                for (FieldDeclaration field : classDecl.getFields()) {
                    for (VariableDeclarator var : field.getVariables()) {
                        classInfo.getFieldTypes().put(var.getNameAsString(), var.getTypeAsString());
                    }
                }

                for (MethodDeclaration methodDecl : classDecl.getMethods()) {
                    String methodName = methodDecl.getNameAsString();
                    String returnType = methodDecl.getTypeAsString();
                    List<String> paramTypes = methodDecl.getParameters().stream()
                            .map(p -> p.getTypeAsString()).collect(Collectors.toList());
                    List<String> paramNames = methodDecl.getParameters().stream()
                            .map(p -> p.getNameAsString()).collect(Collectors.toList());
                    int startLine = methodDecl.getBegin().map(p -> p.line).orElse(0);
                    int endLine = methodDecl.getEnd().map(p -> p.line).orElse(0);
                    boolean isPublic = methodDecl.isPublic();

                    MethodInfo methodInfo = new MethodInfo(
                            methodName, returnType, paramTypes, paramNames,
                            startLine, endLine, isPublic
                    );

                    for (MethodCallExpr callExpr : methodDecl.findAll(MethodCallExpr.class)) {
                        String calleeName = callExpr.getNameAsString();
                        String scope = callExpr.getScope().map(Expression::toString).orElse(null);
                        List<String> args = callExpr.getArguments().stream()
                                .map(Expression::toString).collect(Collectors.toList());
                        int line = callExpr.getBegin().map(p -> p.line).orElse(0);

                        MethodCallInfo callInfo = new MethodCallInfo(
                                calleeName, scope, args, line, isInsideLoop(callExpr),
                                qualifiedName, methodName,
                                fileInfo.getPath().toAbsolutePath().toString()
                        );
                        methodInfo.getCalls().add(callInfo);
                        model.getAllMethodCalls().add(callInfo);
                    }

                    collectStringConcats(methodDecl, fileInfo, qualifiedName, methodName, model);
                    collectObjectCreations(methodDecl, fileInfo, qualifiedName, methodName, model);
                    collectResourceEvents(methodDecl, fileInfo, qualifiedName, methodName, model);
                    classInfo.getMethods().add(methodInfo);
                }

                model.getClasses().add(classInfo);
            }
        } catch (Exception e) {
            model.getParseWarnings().add(fileInfo.getPath() + ": " + e.getMessage());
        }
    }

    private void collectStringConcats(MethodDeclaration methodDecl, JavaFileInfo fileInfo,
                                      String className, String methodName, ProjectModel model) {
        methodDecl.findAll(AssignExpr.class).forEach(expr -> {
            if (!isInsideLoop(expr)) return;

            boolean accumulatingPlusAssign = expr.getOperator() == AssignExpr.Operator.PLUS
                    && isStringExpression(expr.getValue());

            boolean accumulatingSelfAssign = false;
            if (expr.getOperator() == AssignExpr.Operator.ASSIGN
                    && expr.getValue().isBinaryExpr()
                    && expr.getValue().asBinaryExpr().getOperator() == BinaryExpr.Operator.PLUS
                    && isStringExpression(expr.getValue())) {
                String target = expr.getTarget().toString();
                accumulatingSelfAssign = expr.getValue().toString().contains(target);
            }

            if (accumulatingPlusAssign || accumulatingSelfAssign) {
                model.getStringConcatsInLoop().add(new ProjectModel.StringConcatEvent(
                        fileInfo.getPath().toString(), className, methodName,
                        expr.getBegin().map(p -> p.line).orElse(0), expr.toString()));
            }
        });
    }

    private void collectObjectCreations(MethodDeclaration methodDecl, JavaFileInfo fileInfo,
                                        String className, String methodName, ProjectModel model) {
        methodDecl.findAll(ObjectCreationExpr.class).forEach(expr -> {
            if (isInsideLoop(expr)) {
                model.getObjectCreationsInLoop().add(new ProjectModel.ObjectCreationEvent(
                        fileInfo.getPath().toString(), className, methodName,
                        expr.getBegin().map(p -> p.line).orElse(0),
                        expr.getTypeAsString(),
                        expr.getArguments().stream().map(Expression::toString).collect(Collectors.toList())));
            }
        });
    }

    private void collectResourceEvents(MethodDeclaration methodDecl, JavaFileInfo fileInfo,
                                       String className, String methodName, ProjectModel model) {
        methodDecl.findAll(VariableDeclarator.class).forEach(var -> {
            String type = var.getTypeAsString();
            if (isResourceType(type)
                    && !isInsideTryWithResources(var)
                    && !isExplicitlyClosed(methodDecl, var.getNameAsString())) {
                model.getUnclosedResources().add(new ProjectModel.ResourceHandlingEvent(
                        fileInfo.getPath().toString(), className, methodName,
                        var.getBegin().map(p -> p.line).orElse(0), type, var.getNameAsString()));
            }
        });
    }

    private boolean isExplicitlyClosed(MethodDeclaration methodDecl, String variableName) {
        return methodDecl.findAll(MethodCallExpr.class).stream()
                .anyMatch(call -> "close".equals(call.getNameAsString())
                        && call.getScope().map(scope -> variableName.equals(scope.toString())).orElse(false));
    }

    private String buildNestedClassName(ClassOrInterfaceDeclaration declaration) {
        List<String> names = new ArrayList<>();
        ClassOrInterfaceDeclaration current = declaration;
        while (current != null) {
            names.add(0, current.getNameAsString());
            current = current.findAncestor(ClassOrInterfaceDeclaration.class).orElse(null);
        }
        return String.join(".", names);
    }

    private boolean isInsideLoop(Node node) {
        return node.findAncestor(ForStmt.class).isPresent() ||
                node.findAncestor(ForEachStmt.class).isPresent() ||
                node.findAncestor(WhileStmt.class).isPresent() ||
                node.findAncestor(DoStmt.class).isPresent();
    }

    private boolean isStringExpression(Expression expr) {
        String s = expr.toString();
        return s.contains("\"") || s.contains("String") || s.contains(".toString()") ||
                s.contains("report") || s.contains("name") || s.contains("text");
    }

    private boolean isResourceType(String type) {
        if (type == null || type.isBlank()) return false;
        String simple = type.replaceAll("<.*>", "");
        int lastDot = simple.lastIndexOf('.');
        if (lastDot >= 0) simple = simple.substring(lastDot + 1);
        return RESOURCE_TYPES.contains(simple);
    }

    private boolean isInsideTryWithResources(Node node) {
        return node.findAncestor(TryStmt.class)
                .map(t -> !t.getResources().isEmpty() &&
                        t.getResources().stream().anyMatch(r -> r.toString().contains(node.toString())))
                .orElse(false);
    }
}
