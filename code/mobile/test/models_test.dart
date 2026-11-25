import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/screens/signup_screen.dart';
import 'package:mobile/services/auth_service.dart';
import 'package:mobile/services/classroom_service.dart';

void main() {
  group('User.fromJson', () {
    test('maps every field from the API payload', () {
      final user = User.fromJson({
        'id': 'u-1',
        'email': 'student@example.com',
        'full_name': 'Test Student',
        'role': 'student',
        'created_at': '2026-01-01T00:00:00.000Z',
      });

      expect(user.id, 'u-1');
      expect(user.email, 'student@example.com');
      expect(user.fullName, 'Test Student');
      expect(user.role, 'student');
      expect(user.createdAt, '2026-01-01T00:00:00.000Z');
    });

    test('falls back to safe defaults for a partial payload', () {
      final user = User.fromJson({'email': 'student@example.com'});

      expect(user.id, '');
      expect(user.fullName, '');
      expect(user.role, 'student');
      expect(user.createdAt, '');
    });
  });

  group('Classroom.fromJson', () {
    test('parses numeric metrics and defaults nullable ones', () {
      final classroom = Classroom.fromJson({
        'id': 'c-1',
        'course_id': 'course-1',
        'course_code': 'UCS503P',
        'course_name': 'Software Engineering Lab',
        'section_name': '3CSE1',
        'teacher_name': 'Instructor',
        'join_code': 'ABC234',
        'student_count': 42,
        'attendance_avg_rate': 87,
        'quiz_count': 2,
        'pulsemeter_count': 3,
        'open_doubts_count': 4,
      });

      expect(classroom.id, 'c-1');
      expect(classroom.studentCount, 42);
      expect(classroom.attendanceAvgRate, 87.0);
      expect(classroom.quizCount, 2);
      expect(classroom.pulsemeterCount, 3);
      expect(classroom.openDoubtsCount, 4);
    });

    test('defaults attendance to 100% when the API omits it', () {
      final classroom = Classroom.fromJson({'id': 'c-1'});

      expect(classroom.attendanceAvgRate, 100.0);
      expect(classroom.studentCount, 0);
    });
  });

  test('the default API base URL is configured', () {
    expect(AuthService.baseUrl, isNotEmpty);
    expect(AuthService.baseUrl, startsWith('http'));
  });

  testWidgets(
    'signup screen is student-only and points teachers to the web dashboard',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: SignupScreen(onSignupSuccess: () {}, onNavigateToLogin: () {}),
        ),
      );

      expect(find.text('Create Account'), findsOneWidget);
      expect(find.text('Sign Up as Student'), findsOneWidget);
      expect(
        find.text(
          'Teacher accounts are created on the ClassPulse web dashboard.',
        ),
        findsOneWidget,
      );

      // The role selector must not exist on the student-only mobile app.
      expect(find.text('Teacher'), findsNothing);
      expect(find.text('SELECT ROLE'), findsNothing);
    },
  );
}
