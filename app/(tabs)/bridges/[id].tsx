import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  FlatList,
  Dimensions,
  Alert,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import ScreenWrapper from '../../../src/components/ScreenWrapper';
import BridgeCard from '../../../src/components/BridgeCard';
import StarRating from '../../../src/components/StarRating';
import EmptyState from '../../../src/components/EmptyState';
import TipCard from '../../../src/components/TipCard';
import AdditionCard from '../../../src/components/AdditionCard';
import TagSearchModal from '../../../src/components/TagSearchModal';
import BridgeImagePicker from '../../../src/components/BridgeImagePicker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../../src/constants/theme';
import { useBridgeStore } from '../../../src/stores/bridgeStore';
import { useDiscussionStore } from '../../../src/stores/discussionStore';
import { useAuthStore } from '../../../src/stores/authStore';
import type { Bridge, Discussion, Event as EventType } from '../../../src/types/database';
import { supabase } from '../../../src/lib/supabase';
import { formatDate } from '../../../src/lib/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function BridgeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    currentBridge, fetchBridge, fetchSubBridges, rateBridge,
    allTags, fetchAllTags, createTag, updateBridge, deleteBridge,
    tips, fetchTips, addTip, toggleTipLike,
    additions, fetchAdditions, pendingAdditions, fetchPendingAdditions,
    suggestAddition, reviewAddition,
    files, fetchFiles, addFile, removeFile,
    createBridge, generateBridgeContent,
  } = useBridgeStore();
  const { discussions, fetchDiscussions } = useDiscussionStore();
  const { user, session } = useAuthStore();
  const [subBridges, setSubBridges] = useState<Bridge[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);

  // Edit state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [editImages, setEditImages] = useState<string[]>([]);
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  // AI writing mode in edit
  const [editWriteMode, setEditWriteMode] = useState<'manual' | 'ai'>('manual');
  const [editAiPrompt, setEditAiPrompt] = useState('');
  const [editAiLoading, setEditAiLoading] = useState(false);

  // Tips state
  const [newTip, setNewTip] = useState('');

  // Addition state
  const [showAddition, setShowAddition] = useState(false);
  const [additionContent, setAdditionContent] = useState('');
  const [additionLink, setAdditionLink] = useState('');

  // Sub-bridge creation
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [subName, setSubName] = useState('');
  const [subDesc, setSubDesc] = useState('');

  // Image carousel
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // File upload
  const [uploadingFile, setUploadingFile] = useState(false);

  const isCreator = user?.id === currentBridge?.created_by;

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    await Promise.all([
      fetchBridge(id),
      fetchDiscussions(id),
      loadSubBridges(),
      loadEvents(),
      loadUserRating(),
      fetchTips(id),
      fetchAdditions(id),
      fetchAllTags(),
      fetchFiles(id),
    ]);
    // Fetch pending additions if user is creator (will be checked after bridge loads)
    setLoading(false);
  };

  useEffect(() => {
    if (isCreator && id) {
      fetchPendingAdditions(id);
    }
  }, [isCreator, id]);

  const loadSubBridges = async () => {
    if (!id) return;
    const data = await fetchSubBridges(id);
    setSubBridges(data);
  };

  const loadEvents = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('bridge_id', id)
      .order('date', { ascending: true });
    setEvents((data || []) as EventType[]);
  };

  const loadUserRating = async () => {
    if (!id || !user) return;
    const { data } = await supabase
      .from('bridge_ratings')
      .select('rating')
      .eq('bridge_id', id)
      .eq('user_id', user.id)
      .single();
    if (data) setUserRating(data.rating);
  };

  const handleRate = async (rating: number) => {
    if (!user || !id) return;
    setUserRating(rating);
    await rateBridge(id, user.id, rating);
  };

  // Edit handlers
  const openEdit = () => {
    setEditName(currentBridge?.name || '');
    setEditDesc(currentBridge?.description || '');
    setEditTagIds(currentBridge?.tags?.map(t => t.id) || []);
    setEditImages((currentBridge?.images?.map(i => i.image_uri) || []).slice(0, 1));
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!id || !editName.trim()) return;
    if (editTagIds.length === 0) {
      Alert.alert('שגיאה', 'יש לבחור לפחות תגית אחת');
      return;
    }

    const result = await updateBridge(id, { name: editName, description: editDesc }, editTagIds, editImages);
    if (result.error) {
      Alert.alert('שגיאה', result.error);
      return;
    }

    setShowEdit(false);
  };

  const handleToggleEditTag = (tagId: string) => {
    setEditTagIds(prev => prev.includes(tagId) ? prev.filter(i => i !== tagId) : [...prev, tagId]);
  };

  const handleEditAiGenerate = async () => {
    if (!editAiPrompt.trim()) {
      Alert.alert('שגיאה', 'נא להזין הנחיה ל-AI');
      return;
    }
    setEditAiLoading(true);
    const prompt = `ערוך או כתוב מחדש תיאור לגשר "${editName || 'ללא שם'}" עבור קהילת סטודנטים לרפואה. התיאור הנוכחי: "${editDesc}". ההנחיה מהמשתמש: ${editAiPrompt}`;
    const result = await generateBridgeContent(prompt);
    setEditAiLoading(false);
    if (result.error) {
      Alert.alert('שגיאה', result.error);
      return;
    }
    if (result.content) {
      setEditDesc(result.content);
    }
  };

  // Tip handlers
  const handleAddTip = async () => {
    if (!newTip.trim() || !user || !id) return;
    await addTip(id, user.id, newTip.trim());
    setNewTip('');
  };

  const handleLikeTip = async (tipId: string) => {
    if (!user) return;
    await toggleTipLike(tipId, user.id);
  };

  // Addition handlers
  const handleSuggestAddition = async () => {
    if (!additionContent.trim() || !user || !id) return;
    const result = await suggestAddition(id, user.id, additionContent.trim(), additionLink.trim());
    if (!result.error) {
      setShowAddition(false);
      setAdditionContent('');
      setAdditionLink('');
      Alert.alert('נשלח', 'התוספת נשלחה לאישור יוצר הגשר');
    }
  };

  const handleApproveAddition = (additionId: string) => reviewAddition(additionId, true);
  const handleRejectAddition = (additionId: string) => reviewAddition(additionId, false);

  // Sub-bridge creation
  const handleCreateSub = async () => {
    if (!subName.trim() || !user || !session?.user || !id) return;
    const result = await createBridge({ name: subName, description: subDesc, created_by: user.id, parent_id: id }, [], []);
    if (result.error) {
      Alert.alert('שגיאה', result.error);
      return;
    }
    setShowCreateSub(false);
    setSubName('');
    setSubDesc('');
    loadSubBridges();
  };

  // File handlers
  const handlePickFile = async () => {
    if (!user || !id) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      setUploadingFile(true);
      const res = await addFile(id, user.id, {
        name: file.name,
        uri: file.uri,
        type: file.mimeType || '',
        size: file.size || 0,
      });
      setUploadingFile(false);
      if (res.error) Alert.alert('שגיאה', res.error);
    } catch {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    if (!id) return;
    Alert.alert('מחיקת קובץ', 'בטוח שברצונך למחוק את הקובץ?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => removeFile(fileId, id) },
    ]);
  };

  // Delete bridge
  const handleDeleteBridge = () => {
    Alert.alert('מחיקת גשר', 'בטוח שברצונך למחוק את הגשר? פעולה זו לא ניתנת לביטול.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק', style: 'destructive', onPress: async () => {
          if (!id) return;
          const result = await deleteBridge(id);
          if (result.error) {
            Alert.alert('שגיאה', result.error);
            return;
          }
          setShowEdit(false);
          router.back();
        },
      },
    ]);
  };

  const getFileIcon = (type: string): string => {
    if (type.includes('pdf')) return 'document-text';
    if (type.includes('image')) return 'image';
    if (type.includes('video')) return 'videocam';
    if (type.includes('audio')) return 'musical-notes';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'grid';
    if (type.includes('presentation') || type.includes('powerpoint')) return 'easel';
    if (type.includes('word') || type.includes('document')) return 'document';
    return 'attach';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  const bridgeImages = currentBridge?.images || [];

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={24} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentBridge?.name}
          </Text>
          {isCreator ? (
            <TouchableOpacity onPress={openEdit}>
              <Ionicons name="create-outline" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        {/* Image Carousel */}
        {bridgeImages.length > 0 && (
          <View style={styles.carouselContainer}>
            <FlatList
              data={bridgeImages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Image source={{ uri: item.image_uri }} style={styles.carouselImage} />
              )}
              onMomentumScrollEnd={(e) => {
                setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - SPACING.lg * 2)));
              }}
            />
            {bridgeImages.length > 1 && (
              <View style={styles.dotsRow}>
                {bridgeImages.map((_, i) => (
                  <View key={i} style={[styles.dot, i === activeImageIndex && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Bridge Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.bridgeName}>{currentBridge?.name}</Text>
          <Text style={styles.bridgeDesc}>{currentBridge?.description}</Text>

          {/* Creator and dates */}
          <View style={styles.bridgeMetaSection}>
            {currentBridge?.creator?.full_name && (
              <View style={styles.bridgeMetaItem}>
                <Ionicons name="person-outline" size={14} color={COLORS.gray} />
                <Text style={styles.bridgeMetaText}>מקים הגשר: {currentBridge.creator.full_name}</Text>
              </View>
            )}
            <View style={styles.bridgeMetaItem}>
              <Ionicons name="calendar-outline" size={14} color={COLORS.gray} />
              <Text style={styles.bridgeMetaText}>נוצר: {formatDate(currentBridge?.created_at || '')}</Text>
            </View>
            {currentBridge?.updated_at && (
              <View style={styles.bridgeMetaItem}>
                <Ionicons name="create-outline" size={14} color={COLORS.gray} />
                <Text style={styles.bridgeMetaText}>עודכן: {formatDate(currentBridge.updated_at)}</Text>
              </View>
            )}
          </View>

          {/* Tags */}
          {currentBridge?.tags && currentBridge.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {currentBridge.tags.map((tag) => (
                <View key={tag.id} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag.name}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.ratingSection}>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>דירוג ממוצע</Text>
              <StarRating rating={currentBridge?.rating_avg || 0} size={20} />
              <Text style={styles.ratingValue}>
                {currentBridge?.rating_avg?.toFixed(1) || '0'}
              </Text>
            </View>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingLabel}>הדירוג שלך</Text>
              <StarRating rating={userRating} size={20} editable onRate={handleRate} />
            </View>
          </View>
        </View>

        {/* Sub-bridges */}
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => setShowCreateSub(true)}>
            <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>גשרי משנה</Text>
        </View>
        {subBridges.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {subBridges.map((bridge) => (
              <BridgeCard key={bridge.id} bridge={bridge} variant="compact" />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>אין גשרי משנה עדיין</Text>
          </View>
        )}

        {/* Files */}
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={handlePickFile} disabled={uploadingFile}>
            {uploadingFile ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
            )}
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>קבצים</Text>
        </View>
        {files.length > 0 ? (
          files.map((file) => (
            <View key={file.id} style={styles.fileCard}>
              <View style={styles.fileIconContainer}>
                <Ionicons name={getFileIcon(file.file_type) as any} size={22} color={COLORS.primary} />
              </View>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>{file.file_name}</Text>
                <Text style={styles.fileMeta}>
                  {formatFileSize(file.file_size)}
                  {file.uploader?.full_name ? ` · ${file.uploader.full_name}` : ''}
                </Text>
              </View>
              <View style={styles.fileActions}>
                <TouchableOpacity onPress={() => Linking.openURL(file.file_uri)}>
                  <Ionicons name="download-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                {(isCreator || user?.id === file.uploaded_by) && (
                  <TouchableOpacity onPress={() => handleRemoveFile(file.id)}>
                    <Ionicons name="trash-outline" size={20} color={COLORS.red} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>אין קבצים עדיין</Text>
          </View>
        )}

        {/* Additions (approved) */}
        <View style={styles.sectionHeader}>
          <TouchableOpacity onPress={() => setShowAddition(true)}>
            <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>תוספות לגשר</Text>
        </View>
        {/* Pending additions (creator only) */}
        {isCreator && pendingAdditions.length > 0 && (
          <View style={styles.pendingSection}>
            <Text style={styles.pendingTitle}>ממתינים לאישור ({pendingAdditions.length})</Text>
            {pendingAdditions.map((addition) => (
              <AdditionCard
                key={addition.id}
                addition={addition}
                isCreator={true}
                onApprove={handleApproveAddition}
                onReject={handleRejectAddition}
              />
            ))}
          </View>
        )}
        {additions.length > 0 ? (
          additions.map((addition) => (
            <AdditionCard key={addition.id} addition={addition} isCreator={false} />
          ))
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>אין תוספות עדיין</Text>
          </View>
        )}

        {/* Tips */}
        <Text style={styles.sectionTitle}>טיפים</Text>
        <View style={styles.tipInputRow}>
          <TouchableOpacity style={styles.tipSendBtn} onPress={handleAddTip}>
            <Ionicons name="send" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TextInput
            style={styles.tipInput}
            placeholder="שתף טיפ..."
            placeholderTextColor={COLORS.grayLight}
            value={newTip}
            onChangeText={setNewTip}
            textAlign="right"
          />
        </View>
        {tips.length > 0 ? (
          tips.map((tip) => (
            <TipCard
              key={tip.id}
              tip={tip}
              currentUserId={user?.id || ''}
              onLike={handleLikeTip}
            />
          ))
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>אין טיפים עדיין - היה הראשון!</Text>
          </View>
        )}

        {/* Discussions */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionActions}>
            <TouchableOpacity onPress={() => router.push(`/(tabs)/discussions/?bridgeId=${id}&openCreate=true`)}>
              <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/discussions/?bridgeId=${id}`)}
            >
              <Text style={styles.seeAll}>הצג הכל</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionTitle}>דיונים</Text>
        </View>
        {discussions.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>אין דיונים עדיין</Text>
          </View>
        ) : (
          discussions.slice(0, 3).map((disc) => (
            <TouchableOpacity
              key={disc.id}
              style={styles.discussionItem}
              onPress={() => router.push(`/(tabs)/discussions/${disc.id}`)}
            >
              <View style={styles.discussionInfo}>
                <Text style={styles.discussionTitle}>{disc.title}</Text>
                <View style={styles.discussionMeta}>
                  <Ionicons name="people" size={14} color={COLORS.gray} />
                  <Text style={styles.discussionMetaText}>{disc.participants_count}</Text>
                  <Ionicons name="pricetag" size={14} color={COLORS.gray} />
                  <Text style={styles.discussionMetaText}>{disc.tag}</Text>
                </View>
              </View>
              <Ionicons name="chevron-back" size={18} color={COLORS.grayLight} />
            </TouchableOpacity>
          ))
        )}

        {/* Events */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionActions}>
            <TouchableOpacity onPress={() => router.push(`/(tabs)/events/?bridgeId=${id}&openCreate=true`)}>
              <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/events/`)}
            >
              <Text style={styles.seeAll}>הצג הכל</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionTitle}>אירועים</Text>
        </View>
        {events.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>אין אירועים קרובים</Text>
          </View>
        ) : (
          events.slice(0, 3).map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.eventItem}
              onPress={() => router.push(`/(tabs)/events/${event.id}`)}
            >
              <View style={styles.eventDate}>
                <Text style={styles.eventDateText}>{formatDate(event.date)}</Text>
              </View>
              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventDesc} numberOfLines={1}>
                  {event.description}
                </Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={COLORS.grayLight} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>עריכת גשר</Text>
              <View style={{ width: 24 }} />
            </View>
            <TextInput style={styles.modalInput} value={editName} onChangeText={setEditName} textAlign="right" placeholder="שם הגשר" placeholderTextColor={COLORS.grayLight} />

            {/* Writing mode toggle */}
            <Text style={styles.modalLabel}>תיאור:</Text>
            <View style={styles.writeModeRow}>
              <TouchableOpacity
                style={[styles.writeModeBtn, editWriteMode === 'manual' && styles.writeModeBtnActive]}
                onPress={() => setEditWriteMode('manual')}
              >
                <Ionicons name="pencil" size={16} color={editWriteMode === 'manual' ? COLORS.white : COLORS.primaryDark} />
                <Text style={[styles.writeModeText, editWriteMode === 'manual' && styles.writeModeTextActive]}>כתיבה ידנית</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.writeModeBtn, editWriteMode === 'ai' && styles.writeModeBtnActive]}
                onPress={() => setEditWriteMode('ai')}
              >
                <Ionicons name="sparkles" size={16} color={editWriteMode === 'ai' ? COLORS.white : COLORS.primaryDark} />
                <Text style={[styles.writeModeText, editWriteMode === 'ai' && styles.writeModeTextActive]}>עזרת AI</Text>
              </TouchableOpacity>
            </View>

            {editWriteMode === 'ai' && (
              <View style={styles.aiSection}>
                <TextInput
                  style={[styles.modalInput, { height: 60 }]}
                  placeholder="תאר ל-AI מה לשנות או לכתוב..."
                  placeholderTextColor={COLORS.grayLight}
                  value={editAiPrompt}
                  onChangeText={setEditAiPrompt}
                  textAlign="right"
                  multiline
                />
                <TouchableOpacity
                  style={[styles.aiGenerateBtn, editAiLoading && { opacity: 0.7 }]}
                  onPress={handleEditAiGenerate}
                  disabled={editAiLoading}
                >
                  {editAiLoading ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={16} color={COLORS.white} />
                      <Text style={styles.aiGenerateBtnText}>צור תוכן</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
              value={editDesc}
              onChangeText={setEditDesc}
              textAlign="right"
              multiline
              placeholder={editWriteMode === 'ai' ? 'התוכן שנוצר יופיע כאן - ניתן לערוך' : 'תיאור'}
              placeholderTextColor={COLORS.grayLight}
            />

            <Text style={styles.modalLabel}>תגיות:</Text>
            <View style={styles.selectedTagsRow}>
              {allTags.filter(t => editTagIds.includes(t.id)).map(tag => (
                <TouchableOpacity key={tag.id} style={styles.selectedTagChip} onPress={() => handleToggleEditTag(tag.id)}>
                  <Ionicons name="close" size={14} color={COLORS.primary} />
                  <Text style={styles.selectedTagText}>{tag.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.addTagBtn} onPress={() => setShowEditTagModal(true)}>
                <Ionicons name="add" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>תמונות:</Text>
            <BridgeImagePicker images={editImages} onImagesChange={setEditImages} maxImages={1} />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
              <Text style={styles.saveBtnText}>שמור שינויים</Text>
            </TouchableOpacity>

            {isCreator && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteBridge}>
                <Ionicons name="trash-outline" size={18} color={COLORS.red} />
                <Text style={styles.deleteBtnText}>מחק גשר</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Tag Search Modal for Edit */}
      <TagSearchModal
        visible={showEditTagModal}
        onClose={() => setShowEditTagModal(false)}
        allTags={allTags}
        selectedTagIds={editTagIds}
        onToggleTag={handleToggleEditTag}
        onCreateTag={createTag}
      />

      {/* Addition Modal */}
      <Modal visible={showAddition} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.additionModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddition(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>הוסף תוספת</Text>
              <View style={{ width: 24 }} />
            </View>
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="תוכן התוספת..."
              placeholderTextColor={COLORS.grayLight}
              value={additionContent}
              onChangeText={setAdditionContent}
              textAlign="right"
              multiline
            />
            <TextInput
              style={styles.modalInput}
              placeholder="קישור (אופציונלי)"
              placeholderTextColor={COLORS.grayLight}
              value={additionLink}
              onChangeText={setAdditionLink}
              textAlign="right"
              keyboardType="url"
            />
            <Text style={styles.additionNote}>התוספת תישלח לאישור יוצר הגשר</Text>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSuggestAddition}>
              <Text style={styles.saveBtnText}>שלח תוספת</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Sub-bridge Modal */}
      <Modal visible={showCreateSub} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.additionModal}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreateSub(false)}>
                <Ionicons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>גשר משנה חדש</Text>
              <View style={{ width: 24 }} />
            </View>
            <Text style={styles.subParentLabel}>תחת: {currentBridge?.name}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="שם הגשר"
              placeholderTextColor={COLORS.grayLight}
              value={subName}
              onChangeText={setSubName}
              textAlign="right"
            />
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="תיאור"
              placeholderTextColor={COLORS.grayLight}
              value={subDesc}
              onChangeText={setSubDesc}
              textAlign="right"
              multiline
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateSub}>
              <Text style={styles.saveBtnText}>צור גשר משנה</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primaryDark,
    flex: 1,
    textAlign: 'center',
  },
  // Image carousel
  carouselContainer: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  carouselImage: {
    width: SCREEN_WIDTH - SPACING.lg * 2,
    height: 200,
    resizeMode: 'cover',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.cardBg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.grayLight,
  },
  dotActive: {
    backgroundColor: COLORS.primary,
  },
  // Info card
  infoCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  bridgeName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textAlign: 'right',
    marginBottom: SPACING.sm,
  },
  bridgeDesc: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'right',
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  bridgeMetaSection: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  bridgeMetaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  bridgeMetaText: {
    fontSize: 13,
    color: COLORS.gray,
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACING.md,
  },
  tagChip: {
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  ratingSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  ratingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  ratingLabel: {
    fontSize: 14,
    color: COLORS.gray,
    minWidth: 80,
    textAlign: 'right',
  },
  ratingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
  },
  // Sections
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.primaryDark,
    textAlign: 'right',
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAll: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: SPACING.xl,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptySection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray,
  },
  // Discussions
  discussionItem: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  discussionInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  discussionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginBottom: 4,
  },
  discussionMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  discussionMetaText: {
    fontSize: 12,
    color: COLORS.gray,
    marginLeft: SPACING.sm,
  },
  // Events
  eventItem: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  eventDate: {
    backgroundColor: COLORS.cream,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  eventDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  eventInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  eventDesc: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  // Tips input
  tipInputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tipInput: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.black,
    writingDirection: 'rtl',
  },
  tipSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pending additions
  pendingSection: {
    marginBottom: SPACING.md,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.yellow,
    textAlign: 'right',
    marginBottom: SPACING.sm,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
    gap: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  modalInput: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    color: COLORS.black,
    writingDirection: 'rtl',
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
    textAlign: 'right',
  },
  selectedTagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  selectedTagChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
  },
  selectedTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  addTagBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.button,
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  // Addition modal
  additionModal: {
    backgroundColor: COLORS.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: 40,
    gap: SPACING.md,
  },
  additionNote: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Sub-bridge
  subParentLabel: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'right',
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  // Files
  fileCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginBottom: 2,
  },
  fileMeta: {
    fontSize: 12,
    color: COLORS.gray,
  },
  fileActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  // AI writing mode
  writeModeRow: {
    flexDirection: 'row-reverse',
    gap: SPACING.sm,
  },
  writeModeBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.grayLight,
    backgroundColor: COLORS.cardBg,
  },
  writeModeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  writeModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  writeModeTextActive: {
    color: COLORS.white,
  },
  aiSection: {
    gap: SPACING.sm,
  },
  aiGenerateBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  aiGenerateBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  // Delete bridge
  deleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.red,
    marginTop: SPACING.sm,
  },
  deleteBtnText: {
    color: COLORS.red,
    fontSize: 15,
    fontWeight: '700',
  },
});
