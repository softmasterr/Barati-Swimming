class AttendanceLog {
  final String id;
  final String time;
  final String athleteName;
  final String coachName;
  final String status; // approved | warning | denied
  final int sessionsLeft;
  final String note;

  AttendanceLog({
    required this.id,
    required this.time,
    required this.athleteName,
    required this.coachName,
    required this.status,
    required this.sessionsLeft,
    required this.note,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'time': time,
      'athleteName': athleteName,
      'coachName': coachName,
      'status': status,
      'sessionsLeft': sessionsLeft,
      'note': note,
    };
  }

  factory AttendanceLog.fromMap(Map<String, dynamic> map) {
    return AttendanceLog(
      id: map['id'] ?? '',
      time: map['time'] ?? '',
      athleteName: map['athleteName'] ?? '',
      coachName: map['coachName'] ?? '',
      status: map['status'] ?? 'approved',
      sessionsLeft: map['sessionsLeft'] ?? 0,
      note: map['note'] ?? '',
    );
  }
}

class SmsLog {
  final String id;
  final String time;
  final String receiver;
  final String event;
  final String text;
  String status;

  SmsLog({
    required this.id,
    required this.time,
    required this.receiver,
    required this.event,
    required this.text,
    required this.status,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'time': time,
      'receiver': receiver,
      'event': event,
      'text': text,
      'status': status,
    };
  }

  factory SmsLog.fromMap(Map<String, dynamic> map) {
    return SmsLog(
      id: map['id'] ?? '',
      time: map['time'] ?? '',
      receiver: map['receiver'] ?? '',
      event: map['event'] ?? '',
      text: map['text'] ?? '',
      status: map['status'] ?? 'تحویل شده به گوشی',
    );
  }
}

class SyncQueueItem {
  final String id;
  final String time;
  final String type; // ATTENDANCE | PAYMENT | ATHLETE | EXPENSE
  final String title;
  final String payload;
  final String status;

  SyncQueueItem({
    required this.id,
    required this.time,
    required this.type,
    required this.title,
    required this.payload,
    required this.status,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'time': time,
      'type': type,
      'title': title,
      'payload': payload,
      'status': status,
    };
  }

  factory SyncQueueItem.fromMap(Map<String, dynamic> map) {
    return SyncQueueItem(
      id: map['id'] ?? '',
      time: map['time'] ?? '',
      type: map['type'] ?? '',
      title: map['title'] ?? '',
      payload: map['payload'] ?? '',
      status: map['status'] ?? 'pending',
    );
  }
}
