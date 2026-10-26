class TransactionRecord {
  final String id;
  final String date;
  final String type; // income | expense | coach_payout
  final String title;
  final int amount;
  final String method;
  final String author;
  final String poolName;

  TransactionRecord({
    required this.id,
    required this.date,
    required this.type,
    required this.title,
    required this.amount,
    required this.method,
    required this.author,
    this.poolName = '',
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
      'poolName': poolName,
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
      poolName: map['poolName'] ?? '',
    );
  }
}
