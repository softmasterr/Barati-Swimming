class TransactionRecord {
  final String id;
  final String date;
  final String type; // income | expense | coach_payout
  final String title;
  final int amount;
  final String method;
  final String author;

  TransactionRecord({
    required this.id,
    required this.date,
    required this.type,
    required this.title,
    required this.amount,
    required this.method,
    required this.author,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'date': date,
      'type': type,
      'title': title,
      'amount': amount,
      'method': method,
      'author': author,
    };
  }

  factory TransactionRecord.fromMap(Map<String, dynamic> map) {
    return TransactionRecord(
      id: map['id'] ?? '',
      date: map['date'] ?? '',
      type: map['type'] ?? 'income',
      title: map['title'] ?? '',
      amount: map['amount'] ?? 0,
      method: map['method'] ?? '',
      author: map['author'] ?? '',
    );
  }
}
