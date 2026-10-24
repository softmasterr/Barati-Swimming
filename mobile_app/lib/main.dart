import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'providers/academy_provider.dart';
import 'screens/onboarding_screen.dart';
import 'screens/login_screen.dart';
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
        home: const AppStartupDecider(),
      ),
    );
  }
}

class AppStartupDecider extends StatefulWidget {
  const AppStartupDecider({super.key});

  @override
  State<AppStartupDecider> createState() => _AppStartupDeciderState();
}

class _AppStartupDeciderState extends State<AppStartupDecider> {
  bool _isLoading = true;
  bool _isOnboardingDone = false;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkInitialRoute();
  }

  Future<void> _checkInitialRoute() async {
    final prefs = await SharedPreferences.getInstance();
    final onboardingDone = prefs.getBool('onboarding_completed') ?? false;
    final savedUsername = prefs.getString('saved_username');

    if (mounted) {
      setState(() {
        _isOnboardingDone = onboardingDone;
        _isLoggedIn = savedUsername != null && savedUsername.isNotEmpty;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFF0F172A),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF38BDF8)),
        ),
      );
    }

    if (!_isOnboardingDone) {
      return const OnboardingScreen();
    }

    if (!_isLoggedIn) {
      return const LoginScreen();
    }

    return const MainNavigationScreen();
  }
}
