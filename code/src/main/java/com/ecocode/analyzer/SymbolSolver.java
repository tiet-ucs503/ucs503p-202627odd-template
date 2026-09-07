package com.ecocode.analyzer;

import java.util.List;
import java.util.Optional;

/**
 * Lightweight deterministic resolver used by the Iteration-2 prototype.
 * It resolves calls using caller class, field types, explicit class-like scopes,
 * method name and argument count. Calls that cannot be resolved are left null.
 *
 * This is intentionally not advertised as full JavaParser type solving.
 */
public class SymbolSolver {

    public void resolveSymbols(ProjectModel model) {
        List<ClassInfo> classes = model.getClasses();

        for (MethodCallInfo call : model.getAllMethodCalls()) {
            if (call.getResolvedTarget() != null) continue;

            String calleeName = call.getCalleeName();
            String scope = call.getScope();
            int argCount = call.getArguments().size();

            Optional<ClassInfo> callerClass = classes.stream()
                    .filter(c -> c.getQualifiedName().equals(call.getCallerClassName()))
                    .findFirst();

            // Unscoped call such as helper(): first search the caller class itself.
            if (scope == null && callerClass.isPresent()) {
                resolveAgainstClass(call, callerClass.get(), calleeName, argCount);
                continue;
            }

            Optional<ClassInfo> targetClass = Optional.empty();
            if (scope != null && callerClass.isPresent()) {
                String fieldType = callerClass.get().getFieldTypes().get(scope);
                if (fieldType != null) {
                    targetClass = findClassByType(classes, fieldType);
                }
            }

            // Static-style scope such as SomeUtility.doWork().
            if (scope != null && targetClass.isEmpty() && isSimpleIdentifier(scope)) {
                targetClass = classes.stream()
                        .filter(c -> c.getSimpleName().equals(scope) || c.getQualifiedName().equals(scope))
                        .findFirst();
            }

            targetClass.ifPresent(cls -> resolveAgainstClass(call, cls, calleeName, argCount));
        }
    }

    private Optional<ClassInfo> findClassByType(List<ClassInfo> classes, String type) {
        return classes.stream()
                .filter(c -> c.getSimpleName().equals(type) || c.getQualifiedName().equals(type))
                .findFirst();
    }

    private void resolveAgainstClass(MethodCallInfo call, ClassInfo cls,
                                     String methodName, int argCount) {
        cls.getMethods().stream()
                .filter(m -> m.getName().equals(methodName))
                .filter(m -> m.getParameterTypes().size() == argCount)
                .findFirst()
                .ifPresent(m -> call.setResolvedTarget(cls.getQualifiedName() + "#" + methodName));
    }

    private boolean isSimpleIdentifier(String scope) {
        return scope.matches("[A-Za-z_$][A-Za-z0-9_$]*");
    }
}
