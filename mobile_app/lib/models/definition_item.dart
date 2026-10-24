class DefinitionItem {
  final String id;
  final String type; // cost_center | goods_item | course_type
  final String title;
  final String code;
  final String? description;

  DefinitionItem({
    required this.id,
    required this.type,
    required this.title,
    required this.code,
    this.description,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': type,
      'title': title,
      'code': code,
      'description': description ?? '',
    };
  }

  factory DefinitionItem.fromMap(Map<String, dynamic> map) {
    return DefinitionItem(
      id: map['id'] ?? '',
      type: map['type'] ?? '',
      title: map['title'] ?? '',
      code: map['code'] ?? '',
      description: map['description'],
    );
  }
}
