import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View, ActivityIndicator } from 'react-native'
import { AuthProvider, useAuth } from './src/contexts/AuthContext'
import LoginScreen from './src/screens/LoginScreen'
import HomeScreen from './src/screens/HomeScreen'
import ConsultasScreen from './src/screens/ConsultasScreen'
import ChatScreen from './src/screens/ChatScreen'
import PerfilScreen from './src/screens/PerfilScreen'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()

function TabIcon({ name, focused }) {
  const icons = { Home: '🏠', Consultas: '📋', Chat: '💬', Perfil: '👤' }
  return <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.5 }}>{icons[name]}</Text>
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#0047AB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E5E7EB', height: 85, paddingBottom: 20, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#0047AB' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Início', headerTitle: 'Clínica Vida+' }} />
      <Tab.Screen name="Consultas" component={ConsultasScreen} options={{ title: 'Consultas', headerTitle: 'Minhas Consultas' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat', headerTitle: 'Chat com a Clínica' }} />
      <Tab.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Perfil', headerTitle: 'Meu Perfil' }} />
    </Tab.Navigator>
  )
}

function RootNavigator() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0047AB' }}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    )
  }
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabs} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  )
}