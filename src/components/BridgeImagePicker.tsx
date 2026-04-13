import React from 'react';
import { View, Image, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

interface BridgeImagePickerProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export default function BridgeImagePicker({ images, onImagesChange, maxImages = 3 }: BridgeImagePickerProps) {
  const pickImage = async () => {
    if (images.length >= maxImages) {
      Alert.alert('מקסימום תמונות', `ניתן להוסיף עד ${maxImages} תמונות`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      onImagesChange([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {images.map((uri, index) => (
        <View key={index} style={styles.imageWrapper}>
          <Image source={{ uri }} style={styles.image} />
          <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(index)}>
            <Ionicons name="close-circle" size={22} color={COLORS.red} />
          </TouchableOpacity>
        </View>
      ))}
      {images.length < maxImages && (
        <TouchableOpacity style={styles.addBtn} onPress={pickImage}>
          <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
    paddingVertical: 4,
  },
  imageWrapper: {
    position: 'relative',
  },
  image: {
    width: 90,
    height: 90,
    borderRadius: RADIUS.md,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  addBtn: {
    width: 90,
    height: 90,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBg,
  },
});
