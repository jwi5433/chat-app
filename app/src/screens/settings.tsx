import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native'
import { useContext } from 'react'
import { ThemeContext } from '../context'
import * as themes from '../theme'
import { CustomHeader } from '../components/CustomHeader'

const _themes = Object.values(themes).map(v => ({
  name: v.name,
  label: v.label
}))

export function Settings() {
  const { theme, setTheme, themeName } = useContext(ThemeContext)

  const styles = getStyles(theme)

  return (
    <View style={styles.container}>
      <CustomHeader showBackButton />
      <ScrollView
        contentContainerStyle={styles.contentContainer}
      >
        <View
          style={styles.titleContainer}
        >
          <Text
              style={styles.mainText}
          >Theme</Text>
        </View>
        {
          _themes.map((value, index) => (
            <Pressable
              key={index}
              onPress={() => {
                setTheme(value.label)
              }}
              style={({ pressed }) => [
                styles.choiceButton,
                themeName === value.label && styles.selectedChoiceButton,
              ]}
            >
              <View>
                <Text
                  style={[
                    styles.choiceText,
                    themeName === value.label && styles.selectedChoiceText
                  ]}
                >
                  {value.name}
                </Text>
              </View>
            </Pressable>
          ))
        }
      </ScrollView>
    </View>
  )
}

const getStyles = (theme: any) => StyleSheet.create({
  contentContainer: {
    paddingBottom: 50,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    marginTop: 5
  },
  titleContainer: {
    paddingHorizontal: 15,
    paddingTop: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderColor
  },
  mainText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textColor
  },
  choiceButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: 99,
    marginBottom: 10,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.backgroundColor
  },
  selectedChoiceButton: {
    backgroundColor: theme.tintColor,
    borderColor: theme.tintColor,
  },
  choiceText: {
    color: theme.textColor,
    fontWeight: '500'
  },
  selectedChoiceText: {
    color: theme.tintTextColor
  },
  container: {
    flex: 1,
    backgroundColor: theme.backgroundColor
  },
})