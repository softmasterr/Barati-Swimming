class DefinitionItem {
  final String id;
  final String type; // cost_center | goods_item | course_type
  final String title;
  final String code;
  final String? description;
  final int? price;
  final int? sessions;

  DefinitionItem({
    required this.id,
    required this.type,
    required this.title,
    required this.code,
    this.description,
    this.price,
    this.sessions,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': type,
      'title': title,
      'code': code,
      'description': description ?? '',
      'price': price ?? 0,
      'sessions': sessions ?? 0,
    };
  }

  factory DefinitionItem.fromMap(Map<String, dynamic> map) {
    return DefinitionItem(
      id: map['id'] ?? '',
      type: map['type'] ?? '',
      title: map['title'] ?? '',
      code: map['code'] ?? '',
      description: map['description'],
      price: map['price'] != null ? (map['price'] as num).toInt() : null,
      sessions: map['sessions'] != null ? (map['sessions'] as num).toInt() : null,
    );
  }
}
