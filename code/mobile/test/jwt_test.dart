import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/services/jwt.dart';

String _encodeSegment(Map<String, dynamic> value) {
  // Strip padding to mimic real-world (unpadded) JWT segments.
  return base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
}

String _jwt(Map<String, dynamic> payload) {
  final header = _encodeSegment({'alg': 'HS256', 'typ': 'JWT'});
  final body = _encodeSegment(payload);
  return '$header.$body.signature';
}

void main() {
  final now = DateTime.utc(2026, 6, 1, 12, 0, 0);

  group('isJwtExpired', () {
    test('returns false for a token expiring in the future', () {
      final token = _jwt({
        'sub': 'student-1',
        'exp': now.add(const Duration(hours: 1)).millisecondsSinceEpoch ~/ 1000,
      });

      expect(isJwtExpired(token, now: now), isFalse);
    });

    test('returns true for a token that expired in the past', () {
      final token = _jwt({
        'sub': 'student-1',
        'exp':
            now.subtract(const Duration(minutes: 1)).millisecondsSinceEpoch ~/
            1000,
      });

      expect(isJwtExpired(token, now: now), isTrue);
    });

    test('returns true for a token whose exp equals now', () {
      final token = _jwt({'exp': now.millisecondsSinceEpoch ~/ 1000});

      expect(isJwtExpired(token, now: now), isTrue);
    });

    test('returns true for malformed tokens', () {
      expect(isJwtExpired('not-a-jwt'), isTrue);
      expect(isJwtExpired('a.b'), isTrue);
      expect(isJwtExpired('a.!!!.c'), isTrue);

      final nonJsonPayload = base64Url.encode(utf8.encode('not json'));
      expect(isJwtExpired('header.$nonJsonPayload.signature'), isTrue);
    });

    test('returns true when exp is missing or not numeric', () {
      expect(isJwtExpired(_jwt({'sub': 'student-1'})), isTrue);
      expect(isJwtExpired(_jwt({'exp': 'tomorrow'})), isTrue);
    });

    test('returns true for missing or empty tokens', () {
      expect(isJwtExpired(null), isTrue);
      expect(isJwtExpired(''), isTrue);
      expect(isJwtExpired('   '), isTrue);
    });
  });
}
