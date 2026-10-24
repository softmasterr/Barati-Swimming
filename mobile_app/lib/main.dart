import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'providers/academy_provider.dart';
import 'screens/main_navigation_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BaratiSwimmingApp());
}

class BaratiSwimmingApp extends StatelessWidget {
  const BaratiSwimmingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AcademyProvider()),
      ],
      child: MaterialApp(
        title: 'آکادمی شنای براتی',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF0284C7),
            primary: const Color(0xFF0284C7),
            secondary: const Color(0xFF38BDF8),
          ),
          fontFamily: 'Vazirmatn',
          scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        ),
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [
          Locale('fa', 'IR'),
          Locale('en', 'US'),
        ],
        locale: const Locale('fa', 'IR'),
        home: const MainNavigationScreen(),
      ),
    );
  }
}
