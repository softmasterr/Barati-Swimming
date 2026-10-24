enum UserRole { headCoach, assistantCoach }

class UserSession {
  final String id;
  final String name;
  final String username;
  final UserRole role;
  final String? coachId; // Linked coach profile if assistant coach

  UserSession({
    required this.id,
    required this.name,
    required this.username,
    required this.role,
    this.coachId,
  });

  bool get isHeadCoach => role == UserRole.headCoach;
  bool get isAssistantCoach => role == UserRole.assistantCoach;
  String get displayName => name;
  String get roleLabel => isHeadCoach ? 'سرمربی کل آکادمی' : 'مربی کمکی و دستیار';

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'username': username,
      'role': role == UserRole.headCoach ? 'headCoach' : 'assistantCoach',
      'coachId': coachId,
    };
  }

  factory UserSession.fromMap(Map<String, dynamic> map) {
    return UserSession(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      username: map['username'] ?? '',
      role: map['role'] == 'headCoach' ? UserRole.headCoach : UserRole.assistantCoach,
      coachId: map['coachId'],
    );
  }
}
