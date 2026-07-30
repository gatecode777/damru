import * as React from 'react';

declare module 'react-native' {
  interface View extends React.Component<any, any> {}
  interface Text extends React.Component<any, any> {}
  interface TextInput extends React.Component<any, any> {}
  interface ScrollView extends React.Component<any, any> {}
  interface Pressable extends React.Component<any, any> {}
  interface Image extends React.Component<any, any> {}
  interface ActivityIndicator extends React.Component<any, any> {}
  interface KeyboardAvoidingView extends React.Component<any, any> {}
  interface SafeAreaView extends React.Component<any, any> {}
  interface TouchableOpacity extends React.Component<any, any> {}
}
