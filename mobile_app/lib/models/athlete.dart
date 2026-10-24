class Athlete {
  final String id;
  final String name;
  final String phone;
  final String coachId;
  String cardUid;
  final String packageName;
  final int totalSessions;
  int remainingSessions;
  int totalAttended;
  final int tuitionFee;
  int paidAmount;
  int debt;
  final String expireDate;

  Athlete({
    required this.id,
    required this.name,
    required this.phone,
    required this.coachId,
    required this.cardUid,
    required this.packageName,
    required this.totalSessions,
    required this.remainingSessions,
    required this.totalAttended,
    required this.tuitionFee,
    required this.paidAmount,
    required this.debt,
    required this.expireDate,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'coachId': coachId,
      'cardUid': cardUid,
      'packageName': packageName,
      'totalSessions': totalSessions,
      'remainingSessions': remainingSessions,
      'totalAttended': totalAttended,
      'tuitionFee': tuitionFee,
      'paidAmount': paidAmount,
      'debt': debt,
      'expireDate': expireDate,
    };
  }

  factory Athlete.fromMap(Map<String, dynamic> map) {
    return Athlete(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      phone: map['phone'] ?? '',
      coachId: map['coachId'] ?? '',
      cardUid: map['cardUid'] ?? '',
      packageName: map['packageName'] ?? '',
      totalSessions: map['totalSessions'] ?? 0,
      remainingSessions: map['remainingSessions'] ?? 0,
      totalAttended: map['totalAttended'] ?? 0,
      tuitionFee: map['tuitionFee'] ?? 0,
      paidAmount: map['paidAmount'] ?? 0,
      debt: map['debt'] ?? 0,
      expireDate: map['expireDate'] ?? '',
    );
  }
}
