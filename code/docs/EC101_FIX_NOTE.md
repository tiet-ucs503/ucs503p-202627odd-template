# EC101 direct repository-scope fix

EC101 now recognizes calls such as `repo.findById(id)` when `repo` is a field whose declared type is repository/DAO-like (for example `StudentRepository`). This avoids relying only on variable names and does not require the lightweight symbol resolver to have already populated a resolved target for direct field calls.

This preserves the conservative false-positive fix while allowing realistic repository calls in tests and source projects to be detected.
